/**
 * Contract: libraryMocks registry filtering and unknown-name errors.
 */

import { describe, expect, test } from "bun:test";
import path from "node:path";
import { resolveConfig, parseLibraryMocksEnv } from "../../src/config.ts";
import { LIBRARY_REGISTRY, registerLibraryMocks } from "../../src/libraries/index.ts";

describe("contract: library registry", () => {
  test("registry has unique names and covers catalog shims", () => {
    const names = LIBRARY_REGISTRY.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
    // Core shims that must always exist
    for (const required of [
      "reanimated",
      "gesture-handler",
      "safe-area",
      "screens",
      "async-storage",
      "skia",
      "mmkv",
      "device-info",
      "worklets",
      "linear-gradient",
      "webview",
      "netinfo",
      "clipboard",
      "flash-list",
      "picker",
      "maps",
      "video",
      "image-picker",
      "share",
      "bootsplash",
      "keychain",
      "biometrics",
      "config",
      "vision-camera",
      "firebase-app",
      "firebase-auth",
      "firebase-firestore",
      "firebase-messaging",
      "firebase-analytics",
      "firebase-crashlytics",
      "google-signin",
      "stripe",
      "expo",
      "expo-ui",
      "expo-system",
      "expo-hardware",
      "expo-data",
      "expo-web-browser",
      "expo-auth-session",
    ]) {
      expect(names).toContain(required);
    }
  });

  test("libraryMocks: false skips all", () => {
    const result = registerLibraryMocks(resolveConfig({ libraryMocks: false }));
    expect(result.activated).toEqual([]);
    expect(result.skipped.length).toBe(LIBRARY_REGISTRY.length);
  });

  test("libraryMocks: unknown name throws", () => {
    expect(() => registerLibraryMocks(resolveConfig({ libraryMocks: ["not-a-real-shim"] }))).toThrow(
      /Unknown libraryMocks/,
    );
  });

  test("parseLibraryMocksEnv", () => {
    expect(parseLibraryMocksEnv("auto")).toBe("auto");
    expect(parseLibraryMocksEnv("false")).toBe(false);
    expect(parseLibraryMocksEnv("off")).toBe(false);
    expect(parseLibraryMocksEnv("reanimated,skia")).toEqual(["reanimated", "skia"]);
  });

  test("libraryMocks list filters to requested names only", () => {
    const result = registerLibraryMocks(resolveConfig({ libraryMocks: ["reanimated", "worklets"] }));
    for (const a of result.activated) {
      expect(["reanimated", "worklets"]).toContain(a);
    }
    // Names not requested must be skipped
    expect(result.skipped).toContain("skia");
  });

  test("registerLibraryMocks result carries the registry report fields", () => {
    const result = registerLibraryMocks(resolveConfig({ libraryMocks: "auto" }));
    expect(Array.isArray(result.activated)).toBe(true);
    expect(Array.isArray(result.skipped)).toBe(true);
    expect(Array.isArray(result.overridden)).toBe(true);
    expect(Array.isArray(result.disabled)).toBe(true);
    expect(Array.isArray(result.unavailable)).toBe(true);
    // Built-in shims do not declare targets, so no same-target conflicts can arise among them.
    expect(result.overridden).toEqual([]);
  });

  test("disable option removes a shim from the active set", () => {
    const sandbox = path.join(import.meta.dir, "../real-world");
    const prev = process.cwd();
    try {
      process.chdir(sandbox);
      const enabled = registerLibraryMocks(resolveConfig({ libraryMocks: "auto" }));
      const disabled = registerLibraryMocks(resolveConfig({ libraryMocks: "auto", disable: ["reanimated"] }));
      expect(enabled.activated).toContain("reanimated");
      expect(disabled.activated).not.toContain("reanimated");
      expect(disabled.disabled).toContain("reanimated");
    } finally {
      process.chdir(prev);
    }
  });
});
