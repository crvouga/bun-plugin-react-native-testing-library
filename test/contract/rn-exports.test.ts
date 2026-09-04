/**
 * Contract: every getter in react-native/index.js exists on our public mock.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolveConfig } from "../../src/config.ts";
import { createReactNativePublicAPI } from "../../src/mocks/react-native.ts";

function realRnExportNames(): string[] {
  const pkgJson = Bun.resolveSync("react-native/package.json", process.cwd());
  const indexPath = pkgJson.replace(/package\.json$/, "index.js");
  const src = readFileSync(indexPath, "utf8");
  const names = new Set<string>();
  for (const m of src.matchAll(/^\s*get\s+(\w+)\s*\(/gm)) {
    names.add(m[1]!);
  }
  return [...names].sort();
}

describe("contract: RN public API exports", () => {
  test("mock covers every getter from react-native/index.js", () => {
    const api = createReactNativePublicAPI(resolveConfig({ platform: "ios" })) as Record<string, unknown>;
    const expected = realRnExportNames();
    const missing = expected.filter((n) => !(n in api) || api[n] === undefined);
    expect(missing).toEqual([]);
  });

  test("key components are constructible / callable", () => {
    const api = createReactNativePublicAPI(resolveConfig());
    expect(typeof api.View).toBe("function");
    expect(typeof api.Text).toBe("function");
    expect(typeof api.Pressable).toBe("function");
    expect(typeof api.StyleSheet.create).toBe("function");
    expect(typeof api.StyleSheet.flatten).toBe("function");
    expect(typeof api.Platform.select).toBe("function");
    expect(typeof api.codegenNativeComponent).toBe("function");
    expect(typeof api.codegenNativeCommands).toBe("function");
    expect(typeof api.PanResponder.create).toBe("function");
    expect(api.EventEmitter).toBeTruthy();
    expect(api.NativeEventEmitter).toBeTruthy();
  });
});
