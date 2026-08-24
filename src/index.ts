import { serve } from "@hono/node-server";
import { startPeerSync } from "./peer-sync.ts";
import { closeDb } from "./chain-store.ts";
import { app, injectWebSocket } from "./app.ts";
import { PORT } from "./config.ts";

function shutdown(): void {
  closeDb();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

startPeerSync();

const server = serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`serving http://localhost:${PORT}/`);
  console.log(`serving api at http://localhost:${PORT}/api/headers`);
});

injectWebSocket(server);
