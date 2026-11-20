/**
 * Unit: scanUnresolvedEcosystemImports import detection.
 *
 * Covers the dominant import styles in real suites: named, default,
 * namespace, side-effect, require, and dynamic import - plus the
 * type-only and non-ecosystem shapes that must not warn.
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { scanUnresolvedEcosystemImports } from "../../src/diagnostics.ts";

function makeProject(files: Record<string, string>): string {
  const dir = mkdtempSync(path.join(tmpdir(), "diag-scan-"));
  for (const [rel, contents] of Object.entries(files)) {
    const full = path.join(dir, rel);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, contents);
  }
  return dir;
}

describe("diagnostics: scanUnresolvedEcosystemImports", () => {
  test("detects named, default, namespace, side-effect, require, and dynamic forms", () => {
    const dir = makeProject({
      "package.json": JSON.stringify({ name: "scan-probe", dependencies: { react: "19.2.8" } }),
      "app.test.ts": [
        `import { requireNativeModule } from "expo-modules-core";`,
        `import Camera from "react-native-fancy-view";`,
        `import * as Maps from "react-native-maps";`,
        `import "react-native-side-effect";`,
        `const net = require("@react-native-community/netinfo");`,
        `async function load() { return import("expo-unknown-module"); }`,
        `void requireNativeModule; void Camera; void Maps; void net; void load;`,
      ].join("\n"),
    });
    try {
      const warnings = scanUnresolvedEcosystemImports(dir, []);
      const flagged = warnings.join("\n");
      // react-native-maps resolves? It is not installed in the tmp project,
      // so all five ecosystem specifiers must be flagged.
      for (const spec of [
        "expo-modules-core",
        "react-native-fancy-view",
        "react-native-maps",
        "react-native-side-effect",
        "@react-native-community/netinfo",
        "expo-unknown-module",
      ]) {
        expect(flagged).toContain(spec);
      }
      expect(flagged).not.toContain("bun:test");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("resolvable specifiers and type-only imports do not warn", () => {
    const dir = makeProject({
      "package.json": JSON.stringify({ name: "scan-probe2", dependencies: { react: "19.2.8" } }),
      "app.test.ts": [
        `import { test, expect } from "bun:test";`,
        `import type { ExpoConfig } from "expo-config-type";`,
        `import react from "react";`,
        `void react; void test; void expect;`,
      ].join("\n"),
    });
    try {
      const warnings = scanUnresolvedEcosystemImports(dir, []);
      expect(warnings).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
