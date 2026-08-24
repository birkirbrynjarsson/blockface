# blockface

A minimal headers-only Bitcoin P2P client. It connects to the Bitcoin mainnet
peer network, syncs block headers (not full blocks), stores them in SQLite,
and serves the most recent headers and derived chain stats over HTTP.

> **Why "blockface"?** A pun on *clockface* — the live dashboard shows blocks
> as ticks around a clock face, one every ~10 minutes, resetting at local
> midnight. It's also literally accurate: the dial is made of blocks.

## How it works

- **Peer sync** (`src/peer-sync.ts`) connects to a handful of peers via
  `bitcore-p2p`, requests headers starting from the local chain tip, and
  validates each header's proof-of-work and hash link before accepting it.
  It listens for `inv` announcements to pick up new blocks and reconnects
  automatically on disconnect or a stalled sync.
- **Storage** (`src/chain-store.ts`) persists headers in a SQLite database
  (via `better-sqlite3`) so the chain survives restarts, and emits a `tip`
  event whenever a genuinely new header is written.
- **HTTP server** (`src/app.ts`) is a [Hono](https://hono.dev) app that
  exposes the stored headers and some computed stats (difficulty,
  retarget/halving countdowns, estimated hashrate, etc. — see `src/stats.ts`)
  as JSON under `/api`, serves a small live dashboard at `/`, and pushes new
  headers to it over a WebSocket at `/ws` (see `src/ws.ts`).

Sync starts from the real Bitcoin genesis block and every header received
afterwards is independently checked, so a malicious or buggy peer can't
inject an invalid chain.

## Requirements

- [Node.js](https://nodejs.org) >= 22 (runs the TypeScript sources directly,
  no build step)

## Setup

```bash
npm install
npm start
```

Or for development with auto-restart on file changes:

```bash
npm run dev
```

Type-check without emitting:

```bash
npm run check
```

## Configuration

Set via environment variables (see `src/config.ts`):

| Variable      | Default                 | Description                                  |
| ------------- | ------------------------ | --------------------------------------------- |
| `PORT`        | `8332`                   | HTTP server port                              |
| `MAX_HEADERS` | `1000`                   | Max headers returned per `/headers` request   |
| `PEER_COUNT`  | `3`                      | Number of peer connections to maintain        |
| `DB_PATH`     | `./data/headers.sqlite`  | SQLite database file path                     |

## Web dashboard

`GET /` serves a small live dashboard that opens a WebSocket connection to
`/ws` and shows the current tip, derived stats, and a live feed of headers as
they arrive — no polling. The same connection is used to push updates the
moment `chain-store.ts` records a new tip.

## HTTP API

All JSON endpoints are under the `/api` prefix.

### `GET /api/headers?count=N`

Returns the `N` most recent headers (newest first), capped at `MAX_HEADERS`.
Defaults to `10` if `count` is omitted.

```bash
curl "http://localhost:8332/api/headers?count=5"
```

Each entry has the shape:

```json
{
  "height": 900000,
  "hash": "...",
  "prevHash": "...",
  "time": 1735689600,
  "bits": 386089497,
  "nonce": 123456789,
  "version": 536870912,
  "merkleRoot": "...",
  "difficulty": 90666502495565.44
}
```

### `GET /api/headers/:height`

Returns the header at a specific block height, or `404` if it isn't stored
locally.

```bash
curl "http://localhost:8332/api/headers/900000"
```

### `GET /api/stats`

Returns derived chain statistics: current tip, time since last block,
average block interval, difficulty, estimated hashrate, and blocks/estimated
time until the next difficulty retarget and next halving.

```bash
curl "http://localhost:8332/api/stats"
```

## Notes

- Only the most recent headers are guaranteed to stick around long-term
  usage; the full chain is retained in SQLite but `MAX_HEADERS` bounds what
  a single HTTP request can return.
- Shutting down with `SIGINT`/`SIGTERM` checkpoints and closes the database
  cleanly.
