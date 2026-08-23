import bitcoreP2p from "bitcore-p2p";
import bitcoreLib from "bitcore-lib";
import { PEER_COUNT, SEEDS } from "./config.ts";
import {
  addHeader,
  beginBatch,
  chainSize,
  commitBatch,
  getTip,
  hasHeader,
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

  function requestHeaders(fromHashHex: string): void {
    const startHash = Buffer.from(fromHashHex, "hex").reverse();
    peer.sendMessage(messages.GetHeaders({ starts: [startHash] }));
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
    requestHeaders(tip.hash);
    armSyncWatchdog();
  });

  peer.on("headers", (message) => {
    clearSyncWatchdog();

    const headers = message.headers;
    if (headers.length === 0) {
      syncing = false;
      return;
    }

    const tip = getTip();
    let height = tip.height;
    let prevHash = tip.hash;

    beginBatch();
    try {
      for (const header of headers) {
        const obj = header.toObject();
        if (obj.prevHash !== prevHash) {
          if (hasHeader(obj.hash)) {
            // A faster peer already delivered this range; benign race, not an error.
          } else {
            console.warn(`${host}: header chain break from peer, discarding batch`);
          }
          syncing = false;
          return;
        }
        if (!header.validProofOfWork()) {
          console.warn(`${host}: invalid proof of work from peer, discarding batch`);
          syncing = false;
          return;
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
      requestHeaders(prevHash);
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
      requestHeaders(getTip().hash);
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
