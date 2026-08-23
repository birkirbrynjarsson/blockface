import { getTip, getRecentHeaders } from "./chain-store.ts";

const RETARGET_INTERVAL = 2016;
const HALVING_INTERVAL = 210000;
const TARGET_BLOCK_SECONDS = 600;
const AVG_WINDOW = 100;

export interface ChainStats {
  height: number;
  hash: string;
  time: number | null;
  secondsSinceLastBlock: number | null;
  averageBlockIntervalSeconds: number | null;
  difficulty: number | null;
  estimatedHashrate: number | null;
  nextRetargetHeight: number;
  blocksUntilRetarget: number;
  estimatedRetargetTime: number | null;
  nextHalvingHeight: number;
  blocksUntilHalving: number;
  estimatedHalvingTime: number | null;
}

export function computeStats(): ChainStats {
  const tip = getTip();
  const recent = getRecentHeaders(AVG_WINDOW);
  const latest = recent[0];

  const time = latest?.time ?? null;
  const secondsSinceLastBlock =
    time !== null ? Math.floor(Date.now() / 1000) - time : null;

  let averageBlockIntervalSeconds: number | null = null;
  if (recent.length > 1) {
    const oldest = recent[recent.length - 1];
    averageBlockIntervalSeconds =
      (latest.time - oldest.time) / (recent.length - 1);
  }

  const difficulty = latest?.difficulty ?? null;
  const estimatedHashrate =
    difficulty !== null
      ? (difficulty * Math.pow(2, 32)) / TARGET_BLOCK_SECONDS
      : null;

  const blockInterval = averageBlockIntervalSeconds ?? TARGET_BLOCK_SECONDS;

  const nextRetargetHeight =
    Math.ceil((tip.height + 1) / RETARGET_INTERVAL) * RETARGET_INTERVAL;
  const blocksUntilRetarget = nextRetargetHeight - tip.height;
  const estimatedRetargetTime =
    time !== null ? time + blocksUntilRetarget * blockInterval : null;

  const nextHalvingHeight =
    Math.ceil((tip.height + 1) / HALVING_INTERVAL) * HALVING_INTERVAL;
  const blocksUntilHalving = nextHalvingHeight - tip.height;
  const estimatedHalvingTime =
    time !== null ? time + blocksUntilHalving * blockInterval : null;

  return {
    height: tip.height,
    hash: tip.hash,
    time,
    secondsSinceLastBlock,
    averageBlockIntervalSeconds,
    difficulty,
    estimatedHashrate,
    nextRetargetHeight,
    blocksUntilRetarget,
    estimatedRetargetTime,
    nextHalvingHeight,
    blocksUntilHalving,
    estimatedHalvingTime,
  };
}
