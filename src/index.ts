import { startPeerSync } from "./peer-sync.ts";
import { closeDb } from "./chain-store.ts";
import { app } from "./app.ts";
import { websocket } from "./ws.ts";
import { PORT } from "./config.ts";

function shutdown(): void {
  closeDb();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

startPeerSync();

console.log(`serving http://localhost:${PORT}/`);
console.log(`serving api at http://localhost:${PORT}/api/headers`);

export default {
  port: PORT,
  fetch: app.fetch,
  websocket,
};
