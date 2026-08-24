import { createBunWebSocket } from "hono/bun";
import type { ServerWebSocket } from "bun";
import type { WSContext } from "hono/ws";
import { chainEvents } from "./chain-store.ts";
import { computeStats } from "./stats.ts";
import type { HeaderRecord } from "./types.ts";

export const { upgradeWebSocket, websocket } =
  createBunWebSocket<ServerWebSocket>();

const clients = new Set<WSContext>();

// Historical sync can emit thousands of "tip" events back-to-back; coalesce
// them into one broadcast per tick so clients only ever see the latest tip.
const COALESCE_MS = 200;
let pending: HeaderRecord | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function flush(): void {
  flushTimer = null;
  if (!pending) return;
  broadcast({ type: "tip", header: pending, stats: computeStats() });
  pending = null;
}

chainEvents.on("tip", (record: HeaderRecord) => {
  pending = record;
  if (!flushTimer) {
    flushTimer = setTimeout(flush, COALESCE_MS);
  }
});

function broadcast(payload: unknown): void {
  const message = JSON.stringify(payload);
  for (const client of clients) {
    client.send(message);
  }
}

export function registerClient(ws: WSContext): void {
  clients.add(ws);
  ws.send(JSON.stringify({ type: "stats", stats: computeStats() }));
}

export function unregisterClient(ws: WSContext): void {
  clients.delete(ws);
}
