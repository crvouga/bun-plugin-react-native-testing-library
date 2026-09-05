/**
 * Fail-closed: every deep react-native import from sandbox catalog packages
 * must be covered by DEEP_PATHS or DEEP_PATH_ALLOWLIST.
 *
 * Fixture installs are required — missing node_modules is a hard failure.
 */

import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import path from "node:path";
import { DEEP_PATHS, DEEP_PATH_ALLOWLIST } from "../../src/mocks/index.ts";
import { REAL_WORLD_CATALOG } from "./scan/catalog.ts";
import { collectCatalogDeepImports, type ScanIssue } from "./scan/scanner.ts";

const ROOT = path.resolve(import.meta.dir, "../..");
const REAL_WORLD = path.join(ROOT, "test", "real-world");
const REAL_WORLD_EXPO = path.join(ROOT, "test", "real-world-expo");

function covered(specifier: string): boolean {
  if (DEEP_PATH_ALLOWLIST.has(specifier)) return true;
  if (specifier in DEEP_PATHS) return true;
  const noIndex = specifier.replace(/\/index$/, "");
  if (noIndex in DEEP_PATHS || DEEP_PATH_ALLOWLIST.has(noIndex)) return true;
  return false;
}

function assertNoIssues(issues: ScanIssue[], label: string): void {
  if (issues.length === 0) return;
  const lines = issues.slice(0, 40).map((i) => `  ${i.package}: ${i.reason} (${i.path})`);
  expect.unreachable(
    `${label} scan issues:\n${lines.join("\n")}${issues.length > 40 ? `\n  …and ${issues.length - 40} more` : ""}`,
  );
}

describe("contract: deep-path inventory", () => {
  test("catalog packages' react-native/Libraries|src imports are mocked", () => {
    expect(existsSync(path.join(REAL_WORLD, "node_modules"))).toBe(true);

    const issues: ScanIssue[] = [];
    const hits = collectCatalogDeepImports(REAL_WORLD, REAL_WORLD_CATALOG, issues);
    assertNoIssues(issues, "real-world");

    const missing = hits.filter((h) => !covered(h.specifier));
    const bySpec = new Map<string, string[]>();
    for (const m of missing) {
      const list = bySpec.get(m.specifier) ?? [];
      list.push(m.package);
      bySpec.set(m.specifier, list);
    }

    if (bySpec.size > 0) {
      const lines = [...bySpec.entries()]
        .slice(0, 40)
        .map(([spec, pkgs]) => `  ${spec}  ←  ${[...new Set(pkgs)].join(", ")}`);
      expect.unreachable(
        `Unmocked deep react-native imports (add to DEEP_PATHS):\n${lines.join("\n")}${
          bySpec.size > 40 ? `\n  …and ${bySpec.size - 40} more` : ""
        }`,
      );
    }

    expect(existsSync(path.join(REAL_WORLD_EXPO, "node_modules"))).toBe(true);
    const expoIssues: ScanIssue[] = [];
    const expoHits = collectCatalogDeepImports(
      REAL_WORLD_EXPO,
      [
        { name: "expo-modules-core" },
        { name: "expo-router" },
        { name: "expo-constants" },
        { name: "expo-file-system" },
        { name: "expo-sqlite" },
        { name: "expo-web-browser" },
        { name: "expo-auth-session" },
      ],
      expoIssues,
    );
    assertNoIssues(expoIssues, "real-world-expo");
    const expoMissing = expoHits.filter((h) => !covered(h.specifier));
    const expoBySpec = new Map<string, string[]>();
    for (const m of expoMissing) {
      const list = expoBySpec.get(m.specifier) ?? [];
      list.push(m.package);
      expoBySpec.set(m.specifier, list);
    }
    if (expoBySpec.size > 0) {
      const lines = [...expoBySpec.entries()]
        .slice(0, 20)
        .map(([spec, pkgs]) => `  ${spec}  ←  ${[...new Set(pkgs)].join(", ")}`);
      expect.unreachable(`Unmocked expo deep imports:\n${lines.join("\n")}`);
    }
  }, 30_000);

  test("DEEP_PATHS keys are unique and look like react-native paths", () => {
    const keys = Object.keys(DEEP_PATHS);
    expect(new Set(keys).size).toBe(keys.length);
    for (const k of keys) {
      expect(k.startsWith("react-native")).toBe(true);
    }
  });
});
