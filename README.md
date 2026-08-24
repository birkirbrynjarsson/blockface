# headernode

A minimal headers-only Bitcoin P2P client. It connects to the Bitcoin mainnet
peer network, syncs block headers (not full blocks), stores them in SQLite,
and serves the most recent headers and derived chain stats over HTTP.

## How it works

- **Peer sync** (`src/peer-sync.ts`) connects to a handful of peers via
  `bitcore-p2p`, requests headers starting from the local chain tip, and
  validates each header's proof-of-work and hash link before accepting it.
  It listens for `inv` announcements to pick up new blocks and reconnects
  automatically on disconnect or a stalled sync.
- **Storage** (`src/chain-store.ts`) persists headers in a SQLite database
  (via `node:sqlite`) so the chain survives restarts.
- **HTTP server** (`src/http-server.ts`) exposes the stored headers and some
  computed stats (difficulty, retarget/halving countdowns, estimated
  hashrate, etc. — see `src/stats.ts`) as JSON.

Sync starts from the real Bitcoin genesis block and every header received
afterwards is independently checked, so a malicious or buggy peer can't
inject an invalid chain.

## Requirements

- Node.js >= 22.5 (uses the built-in `node:sqlite` module)
- pnpm

## Setup

```bash
pnpm install
pnpm start
```

Or for development with auto-restart on file changes:

```bash
pnpm dev
```

Type-check without emitting:

```bash
pnpm check
```

## Configuration

Set via environment variables (see `src/config.ts`):

| Variable      | Default                 | Description                                  |
| ------------- | ------------------------ | --------------------------------------------- |
| `PORT`        | `8332`                   | HTTP server port                              |
| `MAX_HEADERS` | `1000`                   | Max headers returned per `/headers` request   |
| `PEER_COUNT`  | `3`                      | Number of peer connections to maintain        |
| `DB_PATH`     | `./data/headers.sqlite`  | SQLite database file path                     |

## HTTP API

### `GET /headers?count=N`

Returns the `N` most recent headers (newest first), capped at `MAX_HEADERS`.
Defaults to `10` if `count` is omitted.

```bash
curl "http://localhost:8332/headers?count=5"
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

### `GET /headers/:height`

Returns the header at a specific block height, or `404` if it isn't stored
locally.

```bash
curl "http://localhost:8332/headers/900000"
```

### `GET /stats`

Returns derived chain statistics: current tip, time since last block,
average block interval, difficulty, estimated hashrate, and blocks/estimated
time until the next difficulty retarget and next halving.

```bash
curl "http://localhost:8332/stats"
```

## Notes

- Only the most recent headers are guaranteed to stick around long-term
  usage; the full chain is retained in SQLite but `MAX_HEADERS` bounds what
  a single HTTP request can return.
- Shutting down with `SIGINT`/`SIGTERM` checkpoints and closes the database
  cleanly.
