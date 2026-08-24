import http from "http";
import { MAX_HEADERS, PORT } from "./config.ts";
import { getHeaderByHeight, getRecentHeaders } from "./chain-store.ts";
import { computeStats } from "./stats.ts";

export function startHttpServer(): void {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);

    if (url.pathname === "/headers") {
      const count = Math.min(
        Number(url.searchParams.get("count")) || 10,
        MAX_HEADERS
      );
      const result = getRecentHeaders(count);

      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(result));
      return;
    }

    const heightMatch = url.pathname.match(/^\/headers\/(\d+)$/);
    if (heightMatch) {
      const height = Number(heightMatch[1]);
      const header = getHeaderByHeight(height);

      res.setHeader("Content-Type", "application/json");
      if (!header) {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: "not found" }));
        return;
      }
      res.end(JSON.stringify(header));
      return;
    }

    if (url.pathname === "/stats") {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(computeStats()));
      return;
    }

    res.statusCode = 404;
    res.end("not found");
  });

  server.listen(PORT, () => {
    console.log(`serving recent headers at http://localhost:${PORT}/headers`);
    console.log(`serving derived stats at http://localhost:${PORT}/stats`);
  });
}
