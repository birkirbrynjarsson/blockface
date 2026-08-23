import { startPeerSync } from "./peer-sync.ts";
import { startHttpServer } from "./http-server.ts";
import { closeDb } from "./chain-store.ts";

function shutdown(): void {
  closeDb();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

startPeerSync();
startHttpServer();
