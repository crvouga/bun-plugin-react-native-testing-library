/**
 * Integration: spawn `bun test` inside test/real-world-expo consumer sandbox.
 * Under RN_BUN_RELEASE_GATE=1, skips are forbidden.
 */

import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dir, "../..");
const SANDBOX = path.join(ROOT, "test", "real-world-expo");

describe("integration: real-world-expo sandbox", () => {
  test("bun test in test/real-world-expo passes", async () => {
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
      console.error(out.slice(-6000));
    }
    expect(exitCode).toBe(0);
    expect(out).toMatch(/\d+ pass/);
    expect(out).toMatch(/0 fail/);
  }, 600_000);
});
