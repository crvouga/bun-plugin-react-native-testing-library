/**
 * Contract: official jest-expo native-module definitions are the fallback
 * mock source for Expo modules without a hand-written shim.
 *
 * The expo-core shim consumes jest-expo's preset moduleMocks tables
 * (expoModules / internalExpoModules / thirdPartyModules). These tests pin
 * the fallback chain: package mock -> definitions table -> expo global.
 */

import { describe, expect, test, beforeAll } from "bun:test";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { checkExpoJestExpoVersions } from "../../src/libraries/expo/versions.ts";

const ROOT = path.resolve(import.meta.dir, "../..");
const EXPO_SANDBOX = path.join(ROOT, "test", "real-world-expo");

describe("contract: jest-expo definitions fallback", () => {
  beforeAll(() => {
    if (!existsSync(path.join(EXPO_SANDBOX, "node_modules"))) {
      throw new Error(`expo sandbox missing — run: bun run bootstrap:fixtures`);
    }
    if (!existsSync(path.join(EXPO_SANDBOX, "node_modules/jest-expo"))) {
      throw new Error("jest-expo missing from expo sandbox — definitions fallback untestable");
    }
  });

  async function runProbe(probeFile: string, source: string): Promise<{ code: number; out: string }> {
    const probePath = path.join(EXPO_SANDBOX, probeFile);
    writeFileSync(probePath, source);
    try {
      const proc = Bun.spawn({
        cmd: [process.execPath, "test", "--bail", probeFile],
        cwd: EXPO_SANDBOX,
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
    } finally {
      rmSync(probePath, { force: true });
    }
  }

  test("an Expo module without a hand-written shim resolves through the native-module chain", async () => {
    const { code, out } = await runProbe(
      "__defs-probe-haptics.test.ts",
      `import { test, expect } from "bun:test";
import { requireNativeModule } from "expo-modules-core";
import * as Haptics from "expo-haptics";

test("unshimmed expo module resolves and behaves", async () => {
  const native = requireNativeModule("ExpoHaptics");
  expect(native).toBeTruthy();
  // The public JS wrapper must be backed by a working native-module mock:
  // impactAsync resolves rather than crashing on a missing native module.
  await expect(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)).resolves.toBeUndefined();
});
`,
    );
    if (code !== 0) console.error(out.slice(-2000));
    expect(code).toBe(0);
  }, 120_000);

  test("a hand-written shim's surface wins over the definitions table", async () => {
    const { code, out } = await runProbe(
      "__defs-probe-camera.test.ts",
      `import { test, expect } from "bun:test";
import { Camera, requestCameraPermissionsAsync } from "expo-camera";

test("hand-written camera shim surface intact", () => {
  expect(Camera).toBeTruthy();
  expect(typeof requestCameraPermissionsAsync).toBe("function");
});
`,
    );
    if (code !== 0) console.error(out.slice(-2000));
    expect(code).toBe(0);
  }, 120_000);

  test("definitions tables load from the SDK-matched jest-expo", () => {
    const tablesPath = path.join(EXPO_SANDBOX, "node_modules/jest-expo/src/preset/moduleMocks/expoModules.js");
    expect(existsSync(tablesPath)).toBe(true);
  });
});

describe("contract: expo / jest-expo version pairing", () => {
  test("matching SDK majors pair cleanly", () => {
    expect(checkExpoJestExpoVersions("57.0.20", "57.0.5")).toEqual({ match: true });
    expect(checkExpoJestExpoVersions(null, null)).toEqual({ match: true });
  });

  test("mismatched majors are reported with the fix", () => {
    const result = checkExpoJestExpoVersions("57.0.20", "56.0.0");
    expect(result.match).toBe(false);
    expect(result.note).toMatch(/Install jest-expo@~57/);
    expect(checkExpoJestExpoVersions("57.0.20", null).match).toBe(false);
  });
});
