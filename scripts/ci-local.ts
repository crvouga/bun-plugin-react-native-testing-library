/**
 * Local replica of CI (except the main-only release/publish job).
 *
 * Release law: the only release criteria live in `bun check`.
 * This script may set up the environment and run commitlint, then delegates
 * entirely to `bun check`.
 *
 *   bun run check:full
 */
import { join } from "node:path";

const root = join(import.meta.dir, "..");
process.env.HUSKY = "0";

async function runStep(label: string, argv: string[]): Promise<void> {
  console.log("");
  console.log(`▸ ${label}`);
  console.log(`  $ ${argv.join(" ")}`);
  const proc = Bun.spawn(argv, {
    cwd: root,
    stdout: "inherit",
    stderr: "inherit",
    env: { ...process.env, HUSKY: "0" },
  });
  const code = await proc.exited;
  if (code !== 0) {
    console.error(`check:full FAILED at "${label}" (exit ${code})`);
    process.exit(code);
  }
}

async function git(args: string[]): Promise<{ code: number; stdout: string }> {
  const proc = Bun.spawn(["git", ...args], {
    cwd: root,
    stdout: "pipe",
    stderr: "pipe",
  });
  const stdout = (await new Response(proc.stdout).text()).trim();
  const code = await proc.exited;
  return { code, stdout };
}

async function refExists(ref: string): Promise<boolean> {
  const { code } = await git(["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]);
  return code === 0;
}

async function resolveBaseRef(): Promise<string | null> {
  for (const ref of ["origin/main", "main", "origin/master", "master"]) {
    if (await refExists(ref)) return ref;
  }
  return null;
}

console.log("bun-plugin-react-native-testing-library check:full");
console.log("Delegates release criteria to: bun check");

await runStep("Install (frozen lockfile)", ["bun", "install", "--frozen-lockfile"]);

const branch = (await git(["rev-parse", "--abbrev-ref", "HEAD"])).stdout || "HEAD";
const onMain = branch === "main";
const base = await resolveBaseRef();
if (!onMain && base) {
  const from = (await git(["merge-base", base, "HEAD"])).stdout || base;
  console.log(`Commitlint ${from}..HEAD`);
  const proc = Bun.spawn(["bunx", "commitlint", "--from", from, "--to", "HEAD", "--verbose"], {
    cwd: root,
    stdout: "inherit",
    stderr: "inherit",
  });
  const code = await proc.exited;
  if (code !== 0) process.exit(code);
} else {
  console.log("Commitlint: warning-only on main / no base (matches CI push policy)");
}

await runStep("bun check (canonical release gate)", ["bun", "check"]);

const report = join(root, ".compat-out", "release-report.json");
const text = await Bun.file(report).text();
if (!text.includes("RELEASE READY") && !JSON.parse(text).ok) {
  console.error("check:full: release report missing ok=true");
  process.exit(1);
}
const sentinel = "RELEASE READY: bun check passed";
// scripts/check.ts prints sentinel to stdout; report stores it when ok
const parsed = JSON.parse(text) as { ok: boolean; sentinel: string | null };
if (!parsed.ok || parsed.sentinel !== sentinel) {
  console.error("check:full: canonical RELEASE READY sentinel missing from report");
  process.exit(1);
}

console.log("");
console.log("check:full OK — same release gate as GitHub Actions.");
