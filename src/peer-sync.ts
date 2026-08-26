import bitcoreP2p from "bitcore-p2p";
import bitcoreLib from "bitcore-lib";
import { PEER_COUNT, SEEDS } from "./config.ts";
import {
  addHeader,
  beginBatch,
  buildLocator,
  chainSize,
  commitBatch,
  deleteHeadersFromHeight,
  getHeightForHash,
  getTip,
} from "./chain-store.ts";

const { Peer, Messages, Inventory } = bitcoreP2p;
const { Networks } = bitcoreLib;

const messages = new Messages({ network: Networks.livenet });

let seedIndex = 0;

function nextHost(): string {
  const host = SEEDS[seedIndex % SEEDS.length];
  seedIndex += 1;
  return host;
}

function connectToPeer(): void {
  const host = nextHost();

  let syncing = false;
  let peer: InstanceType<typeof Peer>;
  let watchdog: NodeJS.Timeout | null = null;

  function armSyncWatchdog(): void {
    clearSyncWatchdog();
    watchdog = setTimeout(() => {
      console.warn(`${host}: stopped responding to getheaders, reconnecting`);
      peer.disconnect();
    }, 10000);
  }

  function clearSyncWatchdog(): void {
    if (watchdog) {
      clearTimeout(watchdog);
      watchdog = null;
    }
  }

  // Sends the full locator (not just the tip hash) so a peer that's ahead
  // of a reorg we haven't caught up to yet can still find the actual
  // common ancestor and reply with headers that connect there, instead of
  // us just discarding an unrecognized batch forever. See buildLocator.
  function requestHeaders(): void {
    const locator = buildLocator().map((hex) =>
      Buffer.from(hex, "hex").reverse()
    );
    peer.sendMessage(messages.GetHeaders({ starts: locator }));
  }

  peer = new Peer({ host, network: Networks.livenet });

  peer.on("ready", () => {
    console.log(
      `connected to ${host} (${peer.subversion}), peer height ${peer.bestHeight}`
    );

    const tip = getTip();
    if (peer.bestHeight < tip.height) {
      console.warn(
        `${host}: peer is behind our tip (${peer.bestHeight} < ${tip.height}), reconnecting`
      );
      peer.disconnect();
      return;
    }

    syncing = true;
    requestHeaders();
    armSyncWatchdog();
  });

  peer.on("headers", (message) => {
    clearSyncWatchdog();

    const headers = message.headers;
    if (headers.length === 0) {
      syncing = false;
      return;
    }

    // The peer replies starting right after the last locator hash it
    // recognized on its own best chain. That ancestor can be behind our
    // stored tip if the chain we'd been extending was since reorged out --
    // in which case roll back to it before writing the peer's chain.
    const firstPrevHash = headers[0].toObject().prevHash;
    const ancestorHeight = getHeightForHash(firstPrevHash);
    if (ancestorHeight === undefined) {
      console.warn(
        `${host}: headers don't connect to any block we know, discarding batch`
      );
      syncing = false;
      return;
    }

    const tip = getTip();
    let height = ancestorHeight;
    let prevHash = firstPrevHash;

    beginBatch();
    try {
      if (ancestorHeight < tip.height) {
        console.warn(
          `${host}: reorg detected, rolling back ${tip.height - ancestorHeight} ` +
            `header(s) from height ${ancestorHeight + 1}`
        );
        deleteHeadersFromHeight(ancestorHeight + 1);
      }

      for (const header of headers) {
        const obj = header.toObject();
        if (obj.prevHash !== prevHash) {
          console.warn(`${host}: header chain break mid-batch, discarding rest`);
          break;
        }
        if (!header.validProofOfWork()) {
          console.warn(`${host}: invalid proof of work from peer, discarding rest`);
          break;
        }
        height += 1;
        addHeader({
          height,
          hash: obj.hash,
          prevHash: obj.prevHash,
          time: obj.time,
          bits: obj.bits,
          nonce: obj.nonce,
          version: obj.version,
          merkleRoot: obj.merkleRoot,
          difficulty: header.getDifficulty(),
        });
        prevHash = obj.hash;
      }
    } finally {
      commitBatch();
    }

    if (headers.length === 2000) {
      syncing = true;
      requestHeaders();
      armSyncWatchdog();
    } else {
      syncing = false;
      console.log(
        `${host}: synced to height ${height}, holding last ${chainSize()} headers`
      );
    }
  });

  peer.on("inv", (message) => {
    const hasBlock = message.inventory.some(
      (item) => item.type === Inventory.TYPE.BLOCK
    );
    if (hasBlock && !syncing) {
      syncing = true;
      requestHeaders();
      armSyncWatchdog();
    }
  });

  peer.on("disconnect", () => {
    console.log(`${host}: disconnected, reconnecting in 3s`);
    syncing = false;
    clearSyncWatchdog();
    setTimeout(connectToPeer, 3000);
  });

  peer.on("error", (err) => {
    console.warn(`${host}: peer error:`, err.message);
  });

  peer.connect();
}

export function startPeerSync(): void {
  for (let i = 0; i < PEER_COUNT; i++) {
    connectToPeer();
  }
}
