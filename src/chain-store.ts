import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { EventEmitter } from "node:events";
import type { HeaderRecord } from "./types.ts";
import { DB_PATH, GENESIS_HASH, GENESIS_HEIGHT } from "./config.ts";

mkdirSync(dirname(DB_PATH), { recursive: true });
const db = new Database(DB_PATH);

// Emits "tip" with the new HeaderRecord whenever addHeader() persists a
// header that wasn't already stored (i.e. a genuine chain extension).
export const chainEvents = new EventEmitter();

db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA synchronous = NORMAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS headers (
    height INTEGER PRIMARY KEY,
    hash TEXT NOT NULL UNIQUE,
    prevHash TEXT NOT NULL,
    time INTEGER NOT NULL,
    bits INTEGER NOT NULL,
    nonce INTEGER NOT NULL,
    version INTEGER NOT NULL,
    merkleRoot TEXT NOT NULL,
    difficulty REAL NOT NULL
  )
`);

const insertStmt = db.prepare(`
  INSERT OR IGNORE INTO headers
    (height, hash, prevHash, time, bits, nonce, version, merkleRoot, difficulty)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const tipStmt = db.prepare(
  "SELECT height, hash FROM headers ORDER BY height DESC LIMIT 1"
);
const recentStmt = db.prepare(
  "SELECT * FROM headers ORDER BY height DESC LIMIT ?"
);
const countStmt = db.prepare("SELECT COUNT(*) AS count FROM headers");
const byHeightStmt = db.prepare("SELECT * FROM headers WHERE height = ?");
const heightForHashStmt = db.prepare("SELECT height FROM headers WHERE hash = ?");
const deleteFromHeightStmt = db.prepare("DELETE FROM headers WHERE height >= ?");

export function getTip(): { height: number; hash: string } {
  const row = tipStmt.get() as { height: number; hash: string } | undefined;
  if (!row) return { height: GENESIS_HEIGHT, hash: GENESIS_HASH };
  return row;
}

export function addHeader(record: HeaderRecord): void {
  const { changes } = insertStmt.run(
    record.height,
    record.hash,
    record.prevHash,
    record.time,
    record.bits,
    record.nonce,
    record.version,
    record.merkleRoot,
    record.difficulty
  );
  if (changes > 0) {
    chainEvents.emit("tip", record);
  }
}

export function beginBatch(): void {
  db.exec("BEGIN");
}

export function commitBatch(): void {
  db.exec("COMMIT");
}

export function getRecentHeaders(count: number): HeaderRecord[] {
  return recentStmt.all(count) as unknown as HeaderRecord[];
}

export function getHeaderByHeight(height: number): HeaderRecord | undefined {
  return byHeightStmt.get(height) as HeaderRecord | undefined;
}

export function chainSize(): number {
  const row = countStmt.get() as { count: number };
  return row.count;
}

// Height of the header with this hash, so a peer's response can be checked
// against our own storage even when it starts from an ancestor behind our
// current tip (see buildLocator / deleteHeadersFromHeight below).
export function getHeightForHash(hash: string): number | undefined {
  if (hash === GENESIS_HASH) return GENESIS_HEIGHT;
  const row = heightForHashStmt.get(hash) as { height: number } | undefined;
  return row?.height;
}

// Rolls back everything at or above this height -- used when a peer's
// headers connect to an ancestor behind our stored tip, meaning the chain
// we'd been extending was reorged out and needs to be discarded.
export function deleteHeadersFromHeight(height: number): void {
  deleteFromHeightStmt.run(height);
}

// A Bitcoin Core-style block locator: the last 10 heights consecutively,
// then exponentially larger gaps back to genesis. Sending the whole list
// (not just our tip hash) lets a peer find the actual common ancestor even
// if our stored chain has since been reorged out past our tip -- a single
// tip hash gives the peer no way to recover from that and its reply would
// just never connect to anything we have.
export function buildLocator(): string[] {
  const tip = getTip();
  const locator: string[] = [];
  let height = tip.height;
  let step = 1;
  while (height > GENESIS_HEIGHT) {
    const hash = getHeaderByHeight(height)?.hash;
    if (hash) locator.push(hash);
    if (locator.length >= 10) step *= 2;
    height -= step;
  }
  locator.push(GENESIS_HASH);
  return locator;
}

export function closeDb(): void {
  db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
  db.close();
}
