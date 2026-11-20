/**
 * Contract: bun-rn-doctor CLI (real entry point).
 *
 * Exit 0 on a clean audit; exit 1 with actionable gaps; scaffold writes the
 * registration-ready starter and prints the config snippet.
 */

import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const DOCTOR = path.resolve(import.meta.dir, "../../scripts/doctor.ts");

async function runDoctor(args: string[], cwd: string): Promise<{ code: number; out: string }> {
  const proc = Bun.spawn({
    cmd: [process.execPath, "run", DOCTOR, ...args],
    cwd,
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, FORCE_COLOR: "0" },
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { code, out: `${stdout}${stderr}` };
}

describe("contract: bun-rn-doctor CLI", () => {
  test("audit exits 0 and reports coverage on a covered project", async () => {
    const { code, out } = await runDoctor(["audit"], path.resolve(import.meta.dir, "../.."));
    expect(code).toBe(0);
    expect(out).toContain("compat audit: clean");
    expect(out).toMatch(/Registry shims:/);
  }, 60_000);

  test("audit exits 1 with scaffold suggestions on uncovered deps", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "doctor-cli-"));
    try {
      writeFileSync(
        path.join(dir, "package.json"),
        JSON.stringify({
          dependencies: {
            react: "19.2.8",
            "react-native": "0.87.1",
            "react-native-fancy-view": "^1.0.0",
          },
        }),
      );
      const { code, out } = await runDoctor(["audit"], dir);
      expect(code).toBe(1);
      expect(out).toContain("uncovered");
      expect(out).toContain("bun-rn-doctor scaffold react-native-fancy-view");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60_000);

  test("scaffold writes the starter and prints the registration snippet", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "doctor-cli-scaffold-"));
    try {
      const { code, out } = await runDoctor(["scaffold", "react-native-fancy-view"], dir);
      expect(code).toBe(0);
      const written = path.join(dir, "rn-bun.shims", "react-native-fancy-view.ts");
      expect(readFileSync(written, "utf8")).toContain("defineShim");
      expect(out).toContain("compat: { shims: [shim] }");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60_000);

  test("unknown command exits 2", async () => {
    const { code, out } = await runDoctor(["nonsense"], path.resolve(import.meta.dir, "../.."));
    expect(code).toBe(2);
    expect(out).toMatch(/unknown command/);
  }, 60_000);
});
