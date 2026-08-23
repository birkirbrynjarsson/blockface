export const PORT = Number(process.env.PORT) || 8332;
export const MAX_HEADERS = Number(process.env.MAX_HEADERS) || 1000;
export const SEEDS = [
  "seed.bitcoin.sipa.be",
  "dnsseed.bluematt.me",
  "seed.bitcoinstats.com",
];

// A recent mainnet checkpoint, used only as a starting point for the
// P2P header sync below. It carries no special trust: every header
// received afterwards is still independently checked for valid
// proof-of-work and a correct hash link to the header before it.
export const CHECKPOINT_HEIGHT = 960000;
export const CHECKPOINT_HASH =
  "000000000000000000001268aab06132c2dd203f77b6020462cd177942d6959d";
