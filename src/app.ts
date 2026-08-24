import { Hono } from "hono";
import { MAX_HEADERS } from "./config.ts";
import { getHeaderByHeight, getRecentHeaders } from "./chain-store.ts";
import { computeStats } from "./stats.ts";
import { registerClient, unregisterClient, upgradeWebSocket } from "./ws.ts";

const indexHtml = await Bun.file(
  new URL("./public/index.html", import.meta.url)
).text();

export const app = new Hono();

app.get("/", (c) => c.html(indexHtml));

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
