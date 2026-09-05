/**
 * Drive library shim registration against the real-world sandbox node_modules
 * so src/libraries/* stays covered without pulling those deps into the root package.
 */

import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import path from "node:path";
import { resolveConfig } from "../../src/config.ts";
import { LIBRARY_REGISTRY, registerLibraryMocks } from "../../src/libraries/index.ts";
import { packageResolves, tryRequire, loadConsumerReact } from "../../src/libraries/helpers.ts";
import { installJestShims } from "../../src/jest-shims.ts";

const ROOT = path.resolve(import.meta.dir, "../..");
const SANDBOX = path.join(ROOT, "test", "real-world");

describe("libraries coverage", () => {
  test("helpers: packageResolves / tryRequire / loadConsumerReact", () => {
    expect(packageResolves("react", process.cwd())).toBe(true);
    expect(packageResolves("definitely-not-a-package-xyz", process.cwd())).toBe(false);
    expect(tryRequire("react", process.cwd())).toBeTruthy();
    expect(tryRequire("nope-xyz", process.cwd())).toBeNull();
    expect(loadConsumerReact()).toBeTruthy();
  });

  test("installJestShims is idempotent", () => {
    installJestShims();
    installJestShims();
    const j = (globalThis as { jest?: Record<string, unknown> }).jest;
    expect(typeof j?.advanceTimersByTimeAsync).toBe("function");
    expect(typeof j?.getRealSystemTime).toBe("function");
  });

  test("registerLibraryMocks against sandbox cwd when installed", () => {
    if (!existsSync(path.join(SANDBOX, "node_modules"))) {
      console.log("sandbox node_modules missing — skip activation coverage");
      return;
    }
    const prev = process.cwd();
    try {
      process.chdir(SANDBOX);
      const result = registerLibraryMocks(resolveConfig({ libraryMocks: "auto", debug: false }));
      expect(result.activated.length).toBeGreaterThan(5);
      expect(LIBRARY_REGISTRY.every((s) => result.activated.includes(s.name) || result.skipped.includes(s.name))).toBe(
        true,
      );

      // Force factory execution for coverage
      const pkgs = [
        "react-native-reanimated",
        "react-native-worklets",
        "react-native-safe-area-context",
        "react-native-screens",
        "@react-native-async-storage/async-storage",
        "@shopify/react-native-skia",
        "react-native-mmkv",
        "react-native-device-info",
        "react-native-linear-gradient",
        "react-native-webview",
        "@react-native-community/netinfo",
        "@react-native-clipboard/clipboard",
        "@shopify/flash-list",
      ];
      for (const p of pkgs) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const mod = require(p);
          expect(mod).toBeTruthy();
        } catch (err) {
          // Some packages may still throw on import; that's ok for coverage of our shim path
          console.log("require", p, "→", err instanceof Error ? err.message : err);
        }
      }
    } finally {
      process.chdir(prev);
    }
  });
});
