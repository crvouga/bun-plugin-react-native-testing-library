/**
 * Apply each canary sabotage in a temporary worktree copy when
 * RN_BUN_CANARY_TEMP=1 so interruption cannot leave source modified.
 *
 *   bun run scripts/run-canaries.ts
 */
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CANARIES } from "../test/meta/canaries/defs.ts";

const ROOT = join(import.meta.dir, "..");
const USE_TEMP = process.env.RN_BUN_CANARY_TEMP === "1";

async function runProbe(cwd: string, probe: string[]): Promise<{ code: number; out: string }> {
  const proc = Bun.spawn(["bun", "test", "--bail", ...probe], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, HUSKY: "0" },
  });
  const [stdout, stderr] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text()]);
  await proc.exited;
  return { code: proc.exitCode ?? 1, out: `${stdout}\n${stderr}` };
}

function apply(root: string, file: string, find: string, replace: string): string {
  const path = join(root, file);
  const original = readFileSync(path, "utf8");
  if (!original.includes(find)) {
    throw new Error(`Canary find string not present in ${file}:\n${find}`);
  }
  const next = original.replace(find, replace);
  if (next === original) {
    throw new Error(`Canary replace was a no-op in ${file}`);
  }
  writeFileSync(path, next);
  return original;
}

function restore(root: string, file: string, original: string): void {
  writeFileSync(join(root, file), original);
}

function prepareTempRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), "rn-bun-canary-"));
  // Copy sources + tests needed to run probes (not node_modules — symlink)
  for (const rel of ["src", "test", "package.json", "bunfig.toml", "tsconfig.json"]) {
    const from = join(ROOT, rel);
    if (!existsSync(from)) continue;
    cpSync(from, join(dir, rel), { recursive: true });
  }
  // Reuse installed deps
  cpSync(join(ROOT, "node_modules"), join(dir, "node_modules"), { recursive: true });
  return dir;
}

async function main(): Promise<void> {
  const survivors: string[] = [];
  const killed: string[] = [];
  let workRoot = ROOT;
  let temp: string | null = null;

  if (USE_TEMP) {
    console.log("canaries: using temporary copy (RN_BUN_CANARY_TEMP=1)");
    temp = prepareTempRoot();
    workRoot = temp;
  }

  try {
    for (const canary of CANARIES) {
      process.stdout.write(`canary ${canary.id}… `);
      let original: string | null = null;
      try {
        original = apply(workRoot, canary.file, canary.find, canary.replace);
        const { code, out } = await runProbe(workRoot, canary.probe);
        const ranTests = /\d+ (pass|fail)/.test(out) && !/did not match any test files/.test(out);
        if (!ranTests) {
          survivors.push(canary.id);
          console.log("ERROR probe did not run any tests");
          console.error(out.slice(-1500));
        } else if (code === 0) {
          survivors.push(canary.id);
          console.log("SURVIVED (suite stayed green — proof hole)");
        } else {
          killed.push(canary.id);
          console.log("killed");
        }
      } catch (error) {
        survivors.push(canary.id);
        console.log(`ERROR ${(error as Error).message}`);
      } finally {
        if (original !== null) restore(workRoot, canary.file, original);
      }
    }
  } finally {
    if (temp) rmSync(temp, { recursive: true, force: true });
  }

  console.log("");
  console.log(`killed ${killed.length}/${CANARIES.length}`);
  if (survivors.length > 0) {
    console.error(`SURVIVORS (suite did not fail): ${survivors.join(", ")}`);
    process.exit(1);
  }
  console.log("All canaries killed — suite can detect these sabotages.");
}

await main();
