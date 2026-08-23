import http from "http";
import { MAX_HEADERS, PORT } from "./config.ts";
import { getRecentHeaders } from "./chain-store.ts";

export function startHttpServer(): void {
  const server = http.createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");

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

    res.statusCode = 404;
    res.end("not found");
  });

  server.listen(PORT, () => {
    console.log(`serving recent headers at http://localhost:${PORT}/headers`);
  });
}
