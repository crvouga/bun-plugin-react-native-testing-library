/**
 * Integration: spawn `bun test` inside test/real-world-expo58 (Expo SDK 58,
 * React Native 0.88, React 19.3). Proves the SDK-58 envelope end to end.
 */

import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dir, "../..");
const SANDBOX = path.join(ROOT, "test", "real-world-expo58");

describe("integration: real-world-expo58 sandbox (SDK 58)", () => {
  test("bun test in test/real-world-expo58 passes", async () => {
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
  }, 120_000);
});
