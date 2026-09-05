/**
 * Drive library shim registration against the real-world sandbox node_modules
 * so src/libraries/* stays covered without pulling those deps into the root package.
 */

import { describe, expect, test, beforeAll } from "bun:test";
import { existsSync } from "node:fs";
import path from "node:path";
import { resolveConfig } from "../../src/config.ts";
import { LIBRARY_REGISTRY, registerLibraryMocks } from "../../src/libraries/index.ts";
import { packageResolves, tryRequire, loadConsumerReact } from "../../src/libraries/helpers.ts";
import { __resetKeychainForTests, __resetFirebaseForTests } from "../../src/libraries/ecosystem.ts";
import { installJestShims } from "../../src/jest-shims.ts";

const ROOT = path.resolve(import.meta.dir, "../..");
const SANDBOX = path.join(ROOT, "test", "real-world");

describe("libraries coverage", () => {
  beforeAll(() => {
    if (!existsSync(path.join(SANDBOX, "node_modules"))) {
      throw new Error(`sandbox node_modules missing at ${SANDBOX} — run: bun install --cwd test/real-world`);
    }
  });

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

  test("registerLibraryMocks against sandbox cwd", async () => {
    const prev = process.cwd();
    try {
      process.chdir(SANDBOX);
      __resetKeychainForTests();
      __resetFirebaseForTests();
      const result = registerLibraryMocks(resolveConfig({ libraryMocks: "auto", debug: false }));
      expect(result.activated.length).toBeGreaterThan(5);
      expect(LIBRARY_REGISTRY.every((s) => result.activated.includes(s.name) || result.skipped.includes(s.name))).toBe(
        true,
      );

      // Force factory execution for coverage across core + ecosystem shims
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
        "react-native-maps",
        "react-native-video",
        "react-native-image-picker",
        "react-native-share",
        "react-native-bootsplash",
        "react-native-keychain",
        "react-native-biometrics",
        "react-native-config",
        "react-native-vision-camera",
        "@react-native-firebase/app",
        "@react-native-firebase/auth",
        "@react-native-firebase/firestore",
        "@react-native-firebase/messaging",
        "@react-native-firebase/analytics",
        "@react-native-firebase/crashlytics",
        "@react-native-google-signin/google-signin",
        "@stripe/stripe-react-native",
        "expo-web-browser",
        "expo-auth-session",
      ];
      for (const p of pkgs) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const mod = require(p);
        expect(mod).toBeTruthy();
      }

      // Behavioral keychain smoke
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Keychain = require("react-native-keychain") as {
        setGenericPassword: (u: string, p: string) => Promise<boolean>;
        getGenericPassword: () => Promise<false | { username: string; password: string }>;
      };
      await expect(Keychain.setGenericPassword("u", "p")).resolves.toBe(true);
    } finally {
      process.chdir(prev);
    }
  });
});
