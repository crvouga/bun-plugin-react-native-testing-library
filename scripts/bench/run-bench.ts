#!/usr/bin/env bun
/**
 * Performance benchmark: cold and warm wall-clock of representative RNTL
 * suites under the bun plugin vs the official Jest preset.
 *
 * - Bun side: `bun test` over test/real-world-expo (SDK 57 fixture suite).
 * - Jest side: the oracle Jest fixture (equivalent RNTL operation corpus;
 *   Jest remains fixture-only, mirroring the differential oracle's setup).
 *
 * Cold = no transform/jest caches. Warm = caches left in place. Results are
 * record-only: correctness (the differential oracle) always outranks speed.
 * Output goes to .compat-out/bench-report.json (gitignored).
 */

import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..", "..");
const EXPO_FIXTURE = join(ROOT, "test", "real-world-expo");
const JEST_FIXTURE = join(ROOT, "test", "oracle", "jest-fixture");
const OUT = join(ROOT, ".compat-out", "bench-report.json");
const RUNS = 3;

async function time(cmd: string[], cwd: string, label: string, env: Record<string, string> = {}): Promise<number> {
  const start = performance.now();
  const proc = Bun.spawn({
    cmd,
    cwd,
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, HUSKY: "0", FORCE_COLOR: "0", ...env },
  });
  const code = await proc.exited;
  const ms = Math.round(performance.now() - start);
  if (code !== 0) {
    const err = await new Response(proc.stderr).text();
    throw new Error(`${label} failed (exit ${code}): ${err.slice(-400)}`);
  }
  return ms;
}

async function measureSuite(
  label: string,
  suiteCwd: string,
  cmd: (cold: boolean) => string[],
  clearCaches: () => void,
  env: Record<string, string> = {},
): Promise<Record<string, number>> {
  clearCaches();
  const cold = await time(cmd(true), suiteCwd, `${label} cold`, env);
  const warm: number[] = [];
  for (let i = 0; i < RUNS - 1; i++) {
    warm.push(await time(cmd(false), suiteCwd, `${label} warm ${i + 1}`, env));
  }
  const warmMedian = warm.sort((a, b) => a - b)[Math.floor(warm.length / 2)] ?? warm[0] ?? cold;
  return { cold, warmMedian, warmRuns: warm.length ? warm[warm.length - 1] : cold };
}

async function main(): Promise<void> {
  if (!existsSync(join(EXPO_FIXTURE, "node_modules")))
    throw new Error("expo fixture missing — run: bun run bootstrap:fixtures");
  if (!existsSync(join(JEST_FIXTURE, "node_modules")))
    throw new Error("jest fixture missing — run: bun run compat:oracle");

  mkdirSync(join(ROOT, ".compat-out"), { recursive: true });

  // Primary comparison: the EQUIVALENT oracle corpus (same RNTL operations
  // under both runners), so cold/warm deltas compare like with like.
  console.log("▸ equivalent oracle corpus: bun side");
  const bun = await measureSuite(
    "bun-oracle",
    ROOT,
    () => [process.execPath, "test", "./test/oracle/bun-traces.test.tsx"],
    () => rmSync(join(ROOT, ".rn-bun-cache"), { recursive: true, force: true }),
  );

  console.log("▸ equivalent oracle corpus: jest side (jest-expo preset)");
  const jestSide = await measureSuite(
    "jest-oracle",
    JEST_FIXTURE,
    (cold) => [process.execPath, "x", "jest", "--runInBand", "--forceExit", ...(cold ? ["--clearCache"] : [])],
    () => {},
    { RN_BUN_ORACLE_OUT: join(ROOT, ".compat-out", "bench-oracle-trace.json") },
  );

  // Context (bun only, absolute): the full Expo fixture suite is larger than
  // the oracle corpus, so it has no jest-side equivalent in this repo.
  const bunExpoSuiteCold = await time([process.execPath, "test"], EXPO_FIXTURE, "bun expo suite", {});
  rmSync(join(EXPO_FIXTURE, ".rn-bun-cache"), { recursive: true, force: true });

  const report = {
    recordedAt: new Date().toISOString(),
    bun: process.versions.bun,
    runsPerWarm: RUNS - 1,
    note: "Primary comparison runs the equivalent RNTL operation corpus (test/oracle) under both runners. The full expo fixture suite number is bun-only context — it has no jest-side equivalent in this repo. Record-only; correctness (differential oracle) is the gate.",
    bunPlugin: bun,
    jestExpo: jestSide,
    bunExpoSuiteColdMs: bunExpoSuiteCold,
    speedup: {
      cold: Number((jestSide.cold / bun.cold).toFixed(2)),
      warm: Number((jestSide.warmMedian / bun.warmMedian).toFixed(2)),
    },
  };
  writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);
  console.table({
    "bun plugin (oracle corpus)": { cold: `${bun.cold}ms`, warmMedian: `${bun.warmMedian}ms` },
    "jest-expo (oracle corpus)": { cold: `${jestSide.cold}ms`, warmMedian: `${jestSide.warmMedian}ms` },
    speedup: { cold: `${report.speedup.cold}x`, warmMedian: `${report.speedup.warm}x` },
    "bun expo fixture suite (context)": { cold: `${bunExpoSuiteCold}ms`, warmMedian: "-" },
  });
  console.log(`bench report written to ${OUT}`);
}

process.exitCode = await main();
