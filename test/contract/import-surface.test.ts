/**
 * Fail-closed: catalog packages must import as non-empty modules under the
 * sandbox preload. Platform-entry hazards and native surfaces must have a
 * registry shim. Catalog ↔ sandbox dependencies must match bidirectionally.
 */

import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import path from "node:path";
import * as fc from "fast-check";
import { LIBRARY_REGISTRY } from "../../src/libraries/index.ts";
import { fcRuns } from "../fc-opts.ts";
import { INFRA_ALLOWLIST, REAL_WORLD_CATALOG } from "./scan/catalog.ts";
import {
  collectNativeSurfaces,
  collectPlatformHazards,
  readDirectDependencies,
  type ScanIssue,
} from "./scan/scanner.ts";

const ROOT = path.resolve(import.meta.dir, "../..");
const SANDBOX = path.join(ROOT, "test", "real-world");

describe("contract: import-surface explorer", () => {
  test("sandbox node_modules is present (fail-closed)", () => {
    expect(existsSync(path.join(SANDBOX, "node_modules"))).toBe(true);
  });

  test("catalog ↔ direct sandbox dependencies are bidirectional", () => {
    const direct = readDirectDependencies(SANDBOX);
    const catalogNames = new Set(REAL_WORLD_CATALOG.map((e) => e.name));

    const uncatalogued = [...direct].filter((name) => !INFRA_ALLOWLIST.has(name) && !catalogNames.has(name));
    if (uncatalogued.length > 0) {
      expect.unreachable(
        `Sandbox dependencies missing from REAL_WORLD_CATALOG (or INFRA_ALLOWLIST):\n${uncatalogued
          .map((n) => `  ${n}`)
          .join("\n")}`,
      );
    }

    const missingInstall = REAL_WORLD_CATALOG.filter((e) => !direct.has(e.name)).map((e) => e.name);
    if (missingInstall.length > 0) {
      expect.unreachable(
        `Catalog packages not listed as direct sandbox dependencies:\n${missingInstall.map((n) => `  ${n}`).join("\n")}`,
      );
    }
  });

  test("platform hazards have a registry shim", () => {
    const issues: ScanIssue[] = [];
    const hazards = collectPlatformHazards(SANDBOX, REAL_WORLD_CATALOG, issues);
    if (issues.length > 0) {
      expect.unreachable(
        `Platform hazard scan issues:\n${issues.map((i) => `  ${i.package}: ${i.reason}`).join("\n")}`,
      );
    }
    const registryNames = new Set(LIBRARY_REGISTRY.map((s) => s.name));
    const unshimmed = hazards.filter((h) => {
      const entry = REAL_WORLD_CATALOG.find((c) => c.name === h.package);
      return !entry?.shim || !registryNames.has(entry.shim);
    });
    if (unshimmed.length > 0) {
      expect.unreachable(
        `Platform/Bun-syntax hazards without shim:\n${unshimmed
          .map((h) => `  ${h.package} (${h.reason}) ${h.entry}`)
          .join("\n")}`,
      );
    }
  });

  test("native surfaces map to a registry shim", () => {
    const issues: ScanIssue[] = [];
    const surfaces = collectNativeSurfaces(SANDBOX, REAL_WORLD_CATALOG, issues);
    if (issues.length > 0) {
      // Unreadable runtime files are hard failures
      expect.unreachable(
        `Native surface scan issues:\n${issues
          .slice(0, 30)
          .map((i) => `  ${i.package}: ${i.reason} (${i.path})`)
          .join("\n")}`,
      );
    }
    const registryNames = new Set(LIBRARY_REGISTRY.map((s) => s.name));
    const unmapped = surfaces.filter((s) => {
      const entry = REAL_WORLD_CATALOG.find((c) => c.name === s.package);
      if (entry?.pureJs) return false;
      if (entry?.status === "unsupported") return false;
      return !entry?.shim || !registryNames.has(entry.shim);
    });
    if (unmapped.length > 0) {
      const lines = unmapped.slice(0, 40).map((s) => `  ${s.package} ${s.kind}:${s.name} (${s.file})`);
      expect.unreachable(
        `Native surfaces without registry shim:\n${lines.join("\n")}${
          unmapped.length > 40 ? `\n  …and ${unmapped.length - 40} more` : ""
        }`,
      );
    }
  });

  test("catalog packages require non-empty + expected exports (sandbox spawn)", async () => {
    const probe = path.join(SANDBOX, "import-surface-probe.ts");
    const proc = Bun.spawn({
      cmd: [process.execPath, "run", probe],
      cwd: SANDBOX,
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env, FORCE_COLOR: "0" },
    });
    const [stdout, stderr, code] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    if (code !== 0) {
      console.error(stdout);
      console.error(stderr);
    }
    expect(code).toBe(0);
    expect(stdout + stderr).toMatch(/import-surface ok/);

    const installed = REAL_WORLD_CATALOG.filter((e) => {
      try {
        Bun.resolveSync(e.name, SANDBOX);
        return true;
      } catch {
        return false;
      }
    });
    expect(installed.length).toBe(REAL_WORLD_CATALOG.length);

    fc.assert(
      fc.property(
        fc.shuffledSubarray(installed, { minLength: 1, maxLength: Math.min(10, installed.length) }),
        (subset) => {
          for (const e of subset) {
            expect(Bun.resolveSync(e.name, SANDBOX)).toBeTruthy();
          }
        },
      ),
      fcRuns(20),
    );
  }, 180_000);

  test("LIBRARY_REGISTRY names match catalog shim references", () => {
    const known = new Set(LIBRARY_REGISTRY.map((s) => s.name));
    for (const entry of REAL_WORLD_CATALOG) {
      if (entry.shim) {
        expect(known.has(entry.shim)).toBe(true);
      }
    }
  });
});
