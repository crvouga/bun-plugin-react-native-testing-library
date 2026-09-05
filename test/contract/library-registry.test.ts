/**
 * Contract: libraryMocks registry filtering and unknown-name errors.
 */

import { describe, expect, test } from "bun:test";
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
      "expo",
      "expo-ui",
      "expo-system",
      "expo-hardware",
      "expo-data",
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
});
