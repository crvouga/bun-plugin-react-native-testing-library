/**
 * Differential oracle: identical RNTL operation traces under Bun plugin vs
 * official React Native Jest environment. Failures are hard errors.
 *
 * Jest remains fixture-only (nested under test/oracle/jest-fixture) — never a
 * root dependency.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { compatOut } from "./paths.ts";

const ROOT = join(import.meta.dir, "../..");
const FIXTURE = join(ROOT, "test", "oracle", "jest-fixture");
const CORPUS = join(ROOT, compatOut("oracle-corpus"));
const REPORT = join(ROOT, compatOut("oracle-report.json"));

async function run(cmd: string[], cwd: string, env?: Record<string, string>): Promise<{ code: number; out: string }> {
  const proc = Bun.spawn(cmd, {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, HUSKY: "0", FORCE_COLOR: "0", ...env },
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { code, out: `${stdout}\n${stderr}` };
}

async function ensureFixtureInstalled(): Promise<void> {
  if (!existsSync(join(FIXTURE, "package.json"))) {
    throw new Error(`oracle fixture missing at ${FIXTURE}`);
  }
  if (!existsSync(join(FIXTURE, "node_modules"))) {
    console.log("▸ installing oracle Jest fixture…");
    const { code, out } = await run([process.execPath, "install"], FIXTURE);
    if (code !== 0) throw new Error(`oracle fixture install failed:\n${out}`);
  }
}

async function main(): Promise<void> {
  mkdirSync(CORPUS, { recursive: true });
  await ensureFixtureInstalled();

  console.log("▸ oracle: Bun plugin traces");
  const bun = await run([process.execPath, "test", "--bail", "./test/oracle/bun-traces.test.tsx"], ROOT, {
    RN_BUN_ORACLE_OUT: join(CORPUS, "bun-trace.json"),
  });
  if (bun.code !== 0) {
    console.error(bun.out.slice(-4000));
    throw new Error("Bun oracle traces failed");
  }
  if (!existsSync(join(CORPUS, "bun-trace.json"))) {
    throw new Error("Bun oracle did not write bun-trace.json");
  }

  console.log("▸ oracle: Jest / RN preset traces");
  const jest = await run([process.execPath, "x", "jest", "--runInBand", "--forceExit"], FIXTURE, {
    RN_BUN_ORACLE_OUT: join(CORPUS, "jest-trace.json"),
  });
  if (jest.code !== 0) {
    console.error(jest.out.slice(-4000));
    throw new Error("Jest oracle traces failed");
  }
  if (!existsSync(join(CORPUS, "jest-trace.json"))) {
    throw new Error("Jest oracle did not write jest-trace.json");
  }

  const bunTrace = JSON.parse(readFileSync(join(CORPUS, "bun-trace.json"), "utf8"));
  const jestTrace = JSON.parse(readFileSync(join(CORPUS, "jest-trace.json"), "utf8"));

  const bunJson = JSON.stringify(bunTrace);
  const jestJson = JSON.stringify(jestTrace);
  const ok = bunJson === jestJson;

  writeFileSync(
    REPORT,
    `${JSON.stringify(
      {
        ok,
        bunBytes: bunJson.length,
        jestBytes: jestJson.length,
        operations: Array.isArray(bunTrace?.ops) ? bunTrace.ops.length : null,
      },
      null,
      2,
    )}\n`,
  );

  if (!ok) {
    writeFileSync(join(CORPUS, "diff-bun.json"), `${bunJson}\n`);
    writeFileSync(join(CORPUS, "diff-jest.json"), `${jestJson}\n`);
    console.error(`Differential oracle FAILED — traces diverge. See ${compatOut("oracle-corpus")}/diff-*.json`);
    process.exit(1);
  }

  console.log(`differential oracle OK → ${REPORT}`);
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(String(err));
    process.exit(1);
  });
}
