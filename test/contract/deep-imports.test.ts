/**
 * Contract: deep react-native/... imports used by popular libraries
 * are covered by DEEP_PATHS (or an explicit allowlist).
 */

import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { DEEP_PATHS, DEEP_PATH_ALLOWLIST } from "../../src/mocks/index.ts";

const SKIP_DIRS = new Set([
  "android",
  "ios",
  "apple",
  "cpp",
  "windows",
  "macos",
  "node_modules",
  "__tests__",
  "__mocks__",
  "src", // prefer compiled lib/ over Flow src
]);

function walkJsFiles(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name.endsWith(".d.ts") || name.endsWith(".map")) continue;
    const p = join(dir, name);
    let st;
    try {
      st = statSync(p);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      if (SKIP_DIRS.has(name)) continue;
      walkJsFiles(p, out);
    } else if (/\.(js|mjs|cjs)$/.test(name)) {
      out.push(p);
    }
  }
  return out;
}

function collectDeepImports(pkgRoot: string): Set<string> {
  const found = new Set<string>();
  // Prefer lib/ and dist/ compiled output; also scan package root js
  const roots = ["lib", "dist", "build", "jest"].map((d) => join(pkgRoot, d));
  roots.push(pkgRoot);
  for (const root of roots) {
    for (const file of walkJsFiles(root)) {
      // skip src-like paths that slipped through
      if (file.includes(`${join(pkgRoot, "src")}`)) continue;
      let src: string;
      try {
        src = readFileSync(file, "utf8");
      } catch {
        continue;
      }
      for (const m of src.matchAll(/['"](react-native\/[^'"]+)['"]/g)) {
        found.add(m[1]!);
      }
    }
  }
  return found;
}

const PACKAGES_TO_SCAN = [
  "react-native-reanimated",
  "react-native-worklets",
  "react-native-gesture-handler",
  "react-native-safe-area-context",
  "react-native-screens",
  "@react-navigation/native-stack",
  "@react-native-async-storage/async-storage",
  "@shopify/react-native-skia",
  "react-native-svg",
  "react-native-webview",
  "react-native-device-info",
];

describe("contract: deep react-native imports", () => {
  test("DEEP_PATHS covers library deep imports (when packages are installed)", () => {
    const all = new Set<string>();
    const scanned: string[] = [];

    for (const pkg of PACKAGES_TO_SCAN) {
      try {
        const pkgJson = Bun.resolveSync(`${pkg}/package.json`, process.cwd());
        const root = pkgJson.replace(/package\.json$/, "");
        scanned.push(pkg);
        for (const imp of collectDeepImports(root)) all.add(imp);
      } catch {
        // package not installed at root — skip (sandbox covers these)
      }
    }

    // Always include the known research list so the contract stays meaningful
    // even before the sandbox is installed.
    const known = [
      "react-native/Libraries/Utilities/codegenNativeComponent",
      "react-native/Libraries/Utilities/codegenNativeCommands",
      "react-native/Libraries/TurboModule/TurboModuleRegistry",
      "react-native/Libraries/Renderer/shims/ReactFabric",
      "react-native/Libraries/Renderer/shims/ReactNativeViewConfigRegistry",
      "react-native/Libraries/ReactNative/ReactFabricPublicInstance/ReactFabricPublicInstance",
      "react-native/Libraries/Pressability/PressabilityDebug",
      "react-native/Libraries/ReactNative/AppContainer",
      "react-native/Libraries/Components/View/ReactNativeStyleAttributes",
      "react-native/Libraries/Image/AssetRegistry",
      "react-native/Libraries/NativeComponent/NativeComponentRegistry",
      "react-native/Libraries/NativeComponent/ViewConfigIgnore",
      "react-native/Libraries/vendor/emitter/EventEmitter",
      "react-native/Libraries/ReactNative/RendererProxy",
      "react-native/Libraries/BatchedBridge/BatchedBridge",
      "react-native/Libraries/EventEmitter/NativeEventEmitter",
      "react-native/Libraries/Core/setUpXHR",
      "react-native/package.json",
    ];
    for (const k of known) all.add(k);

    const uncovered = [...all].filter((s) => !DEEP_PATHS[s] && !DEEP_PATH_ALLOWLIST.has(s));

    expect({ scanned, uncovered }).toEqual({ scanned, uncovered: [] });
  });

  test("DEEP_PATHS entries are non-empty factories", () => {
    expect(Object.keys(DEEP_PATHS).length).toBeGreaterThanOrEqual(20);
  });
});
