/**
 * Integration: spawn `bun test` inside test/real-world consumer sandbox.
 * Skip with RN_BUN_SKIP_REAL_WORLD=1.
 */

import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dir, "../..");
const SANDBOX = path.join(ROOT, "test", "real-world");

describe("integration: real-world sandbox", () => {
  test("bun test in test/real-world passes", async () => {
    if (process.env.RN_BUN_SKIP_REAL_WORLD === "1") {
      console.log("RN_BUN_SKIP_REAL_WORLD=1 — skipping");
      return;
    }

    expect(existsSync(path.join(SANDBOX, "package.json"))).toBe(true);

    if (!existsSync(path.join(SANDBOX, "node_modules"))) {
      const install = Bun.spawn({
        cmd: [process.execPath, "install"],
        cwd: SANDBOX,
        stdout: "pipe",
        stderr: "pipe",
        env: { ...process.env, FORCE_COLOR: "0" },
      });
      const code = await install.exited;
      const err = await new Response(install.stderr).text();
      expect(code).toBe(0);
      if (code !== 0) console.error(err);
    }

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
