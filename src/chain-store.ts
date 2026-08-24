import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { EventEmitter } from "node:events";
import type { HeaderRecord } from "./types.ts";
import { DB_PATH, GENESIS_HASH, GENESIS_HEIGHT } from "./config.ts";

mkdirSync(dirname(DB_PATH), { recursive: true });
const db = new Database(DB_PATH, { create: true });

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
const hasHeaderStmt = db.prepare("SELECT 1 FROM headers WHERE hash = ? LIMIT 1");
const byHeightStmt = db.prepare("SELECT * FROM headers WHERE height = ?");

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

export function hasHeader(hash: string): boolean {
  return hasHeaderStmt.get(hash) !== undefined;
}

export function chainSize(): number {
  const row = countStmt.get() as { count: number };
  return row.count;
}

export function closeDb(): void {
  db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
  db.close();
}
