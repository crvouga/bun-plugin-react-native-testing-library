/**
 * Integration: spawn `bun test` inside test/real-world consumer sandbox.
 * Under RN_BUN_RELEASE_GATE=1, skips are forbidden.
 */

import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dir, "../..");
const SANDBOX = path.join(ROOT, "test", "real-world");
const GATE = process.env.RN_BUN_RELEASE_GATE === "1";

describe("integration: real-world sandbox", () => {
  test("bun test in test/real-world passes", async () => {
    if (!GATE && process.env.RN_BUN_SKIP_REAL_WORLD === "1") {
      expect.unreachable("RN_BUN_SKIP_REAL_WORLD is not allowed under release gate; unset it");
    }
    if (process.env.RN_BUN_SKIP_REAL_WORLD === "1") {
      expect.unreachable("RN_BUN_SKIP_REAL_WORLD=1 is forbidden — fixtures must run");
    }

    expect(existsSync(path.join(SANDBOX, "package.json"))).toBe(true);
    expect(existsSync(path.join(SANDBOX, "node_modules"))).toBe(true);

    const proc = Bun.spawn({
      cmd: [process.execPath, "test", "--bail"],
      cwd: SANDBOX,
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env, FORCE_COLOR: "0" },
    });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);

    const out = `${stdout}\n${stderr}`;
    if (exitCode !== 0) {
      console.error(out.slice(-4000));
    }
    expect(exitCode).toBe(0);
    expect(out).toMatch(/\d+ pass/);
    expect(out).toMatch(/0 fail/);
  }, 300_000);
});
