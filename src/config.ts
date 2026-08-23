export const PORT = Number(process.env.PORT) || 8332;
// Max headers returned per HTTP request; the full chain is retained in storage.
export const MAX_HEADERS = Number(process.env.MAX_HEADERS) || 1000;
export const SEEDS = [
  "seed.bitcoin.sipa.be",
  "dnsseed.bluematt.me",
  "seed.bitcoinstats.com",
];

export const DB_PATH = process.env.DB_PATH ?? "./data/headers.sqlite";

// The real Bitcoin mainnet genesis block, used as the starting point for
// the P2P header sync below. Every header received afterwards is still
// independently checked for valid proof-of-work and a correct hash link
// to the header before it.
export const GENESIS_HEIGHT = 0;
export const GENESIS_HASH =
  "000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f";
