import { readFile } from "node:fs/promises";
import { Hono } from "hono";
import { createNodeWebSocket } from "@hono/node-ws";
import { MAX_HEADERS } from "./config.ts";
import { getHeaderByHeight, getRecentHeaders } from "./chain-store.ts";
import { computeStats } from "./stats.ts";
import { registerClient, unregisterClient } from "./ws.ts";

const indexHtml = await readFile(
  new URL("./public/index.html", import.meta.url),
  "utf-8"
);
const clockHtml = await readFile(
  new URL("./public/clock.html", import.meta.url),
  "utf-8"
);

export const app = new Hono();

export const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({
  app,
});

app.get("/", (c) => c.html(indexHtml));
app.get("/clock", (c) => c.html(clockHtml));

app.get("/api/headers", (c) => {
  const count = Math.min(Number(c.req.query("count")) || 10, MAX_HEADERS);
  return c.json(getRecentHeaders(count));
});

app.get("/api/headers/:height", (c) => {
  const height = Number(c.req.param("height"));
  const header = getHeaderByHeight(height);
  if (!header) {
    return c.json({ error: "not found" }, 404);
  }
  return c.json(header);
});

app.get("/api/stats", (c) => c.json(computeStats()));

app.get(
  "/ws",
  upgradeWebSocket(() => ({
    onOpen: (_event, ws) => registerClient(ws),
    onClose: (_event, ws) => unregisterClient(ws),
  }))
);
