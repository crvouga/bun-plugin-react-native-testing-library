/**
 * Shared fast-check options — fail fast, tunable via env.
 *
 *   RN_BUN_FC_RUNS=100 bun test   # soak
 *   RN_BUN_FC_SEED=12345 bun test # replay
 */

import type { Parameters } from "fast-check";

const SEED = Number(process.env.RN_BUN_FC_SEED ?? "0x5a17e0e1");
const RUNS = Number(process.env.RN_BUN_FC_RUNS ?? "40");

/** Default property-test budget (fail-fast). Override with RN_BUN_FC_RUNS. */
export const fcOpts: Parameters<unknown> = {
  numRuns: Number.isFinite(RUNS) && RUNS > 0 ? RUNS : 40,
  seed: Number.isFinite(SEED) ? SEED : 0x5a17e0e1,
  endOnFailure: true,
  verbose: false,
};

export function fcRuns(n: number): Parameters<unknown> {
  return { ...fcOpts, numRuns: n };
}
