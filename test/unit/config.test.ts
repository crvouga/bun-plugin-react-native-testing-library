import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { loadConfig, resolveConfig } from "../../src/config.ts";

describe("config.ts", () => {
  test("defaults", () => {
    const c = resolveConfig();
    expect(c.platform).toBe("ios");
    expect(c.strategy).toBe("auto");
    expect(c.debug).toBe(false);
    expect(c.window.width).toBe(390);
    expect(c.assetExts).toContain("png");
  });

  test("overrides", () => {
    const c = resolveConfig({
      platform: "android",
      debug: true,
      window: { width: 100 },
      strategy: "direct",
    });
    expect(c.platform).toBe("android");
    expect(c.debug).toBe(true);
    expect(c.window.width).toBe(100);
    expect(c.window.height).toBe(844);
    expect(c.strategy).toBe("direct");
  });

  test("loadConfig reads env", () => {
    const prev = { ...process.env };
    process.env.RN_BUN_PLATFORM = "android";
    process.env.RN_BUN_DEBUG = "1";
    process.env.RN_BUN_STRATEGY = "namespace";
    try {
      const c = loadConfig();
      expect(c.platform).toBe("android");
      expect(c.debug).toBe(true);
      expect(c.strategy).toBe("namespace");
    } finally {
      process.env = prev;
    }
  });
});

describe("package.json peer/deps hygiene", () => {
  test("direct dependencies contain no jest or metro packages", () => {
    const pkg = JSON.parse(readFileSync(path.resolve(import.meta.dir, "../../package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const all = { ...pkg.dependencies, ...pkg.devDependencies };
    const offenders = Object.keys(all).filter(
      (name) =>
        /^(jest|jest-|@jest\/|babel-jest|metro|metro-|@metro\/)/.test(name) ||
        name === "jest-expo" ||
        name === "react-test-renderer",
    );
    expect(offenders).toEqual([]);
  });
});
