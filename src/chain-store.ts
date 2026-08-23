import type { HeaderRecord } from "./types.ts";
import { CHECKPOINT_HASH, CHECKPOINT_HEIGHT, MAX_HEADERS } from "./config.ts";

const chain = new Map<number, HeaderRecord>();
let tipHeight = CHECKPOINT_HEIGHT;
let tipHash = CHECKPOINT_HASH;

export function getTip(): { height: number; hash: string } {
  return { height: tipHeight, hash: tipHash };
}

export function setTip(height: number, hash: string): void {
  tipHeight = height;
  tipHash = hash;
}

export function addHeader(record: HeaderRecord): void {
  chain.set(record.height, record);
}

export function trimChain(): void {
  if (chain.size <= MAX_HEADERS) return;
  const heights = Array.from(chain.keys()).sort((a, b) => a - b);
  const excess = heights.length - MAX_HEADERS;
  for (let i = 0; i < excess; i++) chain.delete(heights[i]);
}

export function getRecentHeaders(count: number): HeaderRecord[] {
  const heights = Array.from(chain.keys())
    .sort((a, b) => b - a)
    .slice(0, count);
  return heights.map((h) => chain.get(h)!);
}

export function chainSize(): number {
  return chain.size;
}
