/**
 * Canonical release gate: `bun check`.
 *
 * Runs every stage in CHECK_STAGES, writes compat/release-report.json, and
 * prints RELEASE READY only after all stages pass. Leaves the tree unchanged
 * (canaries use temp copies when RN_BUN_CANARY_TEMP=1).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { CHECK_STAGES, RELEASE_READY_SENTINEL, REPORT_PATH, type CheckStage } from "./check-manifest.ts";

const ROOT = join(import.meta.dir, "..");

type StageResult = {
  id: string;
  label: string;
  ok: boolean;
  seconds: number;
  exitCode: number;
};

async function runStage(stage: CheckStage): Promise<StageResult> {
  console.log("");
  console.log("=".repeat(72));
  console.log(`  ${stage.label}`);
  console.log("=".repeat(72));
  console.log(`$ ${stage.argv.join(" ")}`);

  const started = performance.now();
  const proc = Bun.spawn([...stage.argv], {
    cwd: ROOT,
    stdout: "inherit",
    stderr: "inherit",
    env: {
      ...process.env,
      HUSKY: "0",
      RN_BUN_RELEASE_GATE: "1",
      ...stage.env,
    },
  });
  const exitCode = await proc.exited;
  const seconds = (performance.now() - started) / 1000;
  const ok = exitCode === 0;
  if (ok) {
    console.log(`✓ ${stage.id} (${seconds.toFixed(1)}s)`);
  } else {
    console.error(`✗ ${stage.id} failed (exit ${exitCode}, ${seconds.toFixed(1)}s)`);
  }
  return { id: stage.id, label: stage.label, ok, seconds, exitCode };
}

async function main(): Promise<void> {
  console.log("bun-plugin-react-native-testing-library — bun check (release gate)");
  console.log(`stages: ${CHECK_STAGES.map((s) => s.id).join(", ")}`);

  const results: StageResult[] = [];
  const reportStarted = new Date().toISOString();

  for (const stage of CHECK_STAGES) {
    const result = await runStage(stage);
    results.push(result);
    if (!result.ok) {
      writeReport(reportStarted, results, false);
      console.error("");
      console.error(`bun check FAILED at "${stage.id}". Fix, then re-run: bun check`);
      process.exit(result.exitCode || 1);
    }
  }

  writeReport(reportStarted, results, true);

  const total = results.reduce((s, r) => s + r.seconds, 0);
  console.log("");
  console.log("=".repeat(72));
  for (const r of results) {
    console.log(`  ${r.seconds.toFixed(1).padStart(6)}s  ${r.id}`);
  }
  console.log(`  ${total.toFixed(1).padStart(6)}s  total`);
  console.log("=".repeat(72));
  console.log(RELEASE_READY_SENTINEL);
}

function writeReport(startedAt: string, results: StageResult[], ok: boolean): void {
  const path = join(ROOT, REPORT_PATH);
  mkdirSync(dirname(path), { recursive: true });
  const report = {
    ok,
    startedAt,
    finishedAt: new Date().toISOString(),
    bun: Bun.version,
    platform: process.platform,
    arch: process.arch,
    stages: results,
    sentinel: ok ? RELEASE_READY_SENTINEL : null,
  };
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`wrote ${REPORT_PATH}`);
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(String(err));
    process.exit(1);
  });
}
