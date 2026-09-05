/**
 * Shared fast-check options — fail fast, tunable via env.
 *
 *   RN_BUN_FC_RUNS=100 bun test   # soak
 *   RN_BUN_FC_SEED=12345 bun test # replay
 *   RN_BUN_FC_PATH='0:1:2' bun test # replay command path when supported
 */

import type { Parameters } from "fast-check";

const SEED = Number(process.env.RN_BUN_FC_SEED ?? "0x5a17e0e1");
const RUNS = Number(process.env.RN_BUN_FC_RUNS ?? "100");
const PATH = process.env.RN_BUN_FC_PATH;

/** Default property-test budget (fail-fast). Override with RN_BUN_FC_RUNS. */
export const fcOpts: Parameters<unknown> = {
  numRuns: Number.isFinite(RUNS) && RUNS > 0 ? RUNS : 100,
  seed: Number.isFinite(SEED) ? SEED : 0x5a17e0e1,
  endOnFailure: true,
  verbose: Boolean(PATH),
  ...(PATH
    ? {
        // fast-check path replay: colon/comma separated integers
        path: PATH.includes(":") ? PATH : PATH.replace(/,/g, ":"),
      }
    : {}),
};

export function fcRuns(n?: number): Parameters<unknown> {
  const override = process.env.RN_BUN_FC_RUNS;
  if (override != null && override !== "") {
    const parsed = Number(override);
    if (Number.isFinite(parsed) && parsed > 0) {
      return { ...fcOpts, numRuns: parsed };
    }
  }
  return { ...fcOpts, numRuns: n ?? fcOpts.numRuns };
}
