import bitcoreP2p from "bitcore-p2p";
import bitcoreLib from "bitcore-lib";
import { SEEDS } from "./config.ts";
import {
  addHeader,
  chainSize,
  getTip,
  setTip,
  trimChain,
} from "./chain-store.ts";

const { Peer, Messages, Inventory } = bitcoreP2p;
const { Networks } = bitcoreLib;

const messages = new Messages({ network: Networks.livenet });

let syncing = false;
let peer: InstanceType<typeof Peer>;
let seedIndex = 0;
let watchdog: NodeJS.Timeout | null = null;

function armSyncWatchdog(): void {
  clearSyncWatchdog();
  watchdog = setTimeout(() => {
    console.warn("peer stopped responding to getheaders, reconnecting");
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

export function startPeerSync(): void {
  const host = SEEDS[seedIndex % SEEDS.length];
  seedIndex += 1;

  peer = new Peer({ host, network: Networks.livenet });

  peer.on("ready", () => {
    console.log(
      `connected to ${peer.host} (${peer.subversion}), peer height ${peer.bestHeight}`
    );

    const tip = getTip();
    if (peer.bestHeight < tip.height) {
      console.warn(
        `peer is behind our tip (${peer.bestHeight} < ${tip.height}), reconnecting`
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
      trimChain();
      return;
    }

    const tip = getTip();
    let height = tip.height;
    let prevHash = tip.hash;

    for (const header of headers) {
      const obj = header.toObject();
      if (obj.prevHash !== prevHash) {
        console.warn("header chain break from peer, discarding batch");
        return;
      }
      if (!header.validProofOfWork()) {
        console.warn("invalid proof of work from peer, discarding batch");
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

    setTip(height, prevHash);
    trimChain();

    if (headers.length === 2000) {
      requestHeaders(prevHash);
      armSyncWatchdog();
    } else {
      syncing = false;
      console.log(
        `synced to height ${height}, holding last ${chainSize()} headers`
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
    console.log("peer disconnected, reconnecting in 3s");
    syncing = false;
    clearSyncWatchdog();
    setTimeout(startPeerSync, 3000);
  });

  peer.on("error", (err) => {
    console.warn("peer error:", err.message);
  });

  peer.connect();
}
