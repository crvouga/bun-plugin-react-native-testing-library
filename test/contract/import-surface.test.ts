/**
 * Fail-closed: catalog packages must import as non-empty modules under the
 * sandbox preload. Platform-entry hazards must have a registry shim.
 */

import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import path from "node:path";
import * as fc from "fast-check";
import { LIBRARY_REGISTRY } from "../../src/libraries/index.ts";
import { fcRuns } from "../fc-opts.ts";
import { REAL_WORLD_CATALOG } from "./scan/catalog.ts";
import { collectPlatformHazards } from "./scan/scanner.ts";

const ROOT = path.resolve(import.meta.dir, "../..");
const SANDBOX = path.join(ROOT, "test", "real-world");

describe("contract: import-surface explorer", () => {
  test("platform hazards have a registry shim", () => {
    if (!existsSync(path.join(SANDBOX, "node_modules"))) {
      console.log("sandbox node_modules missing — skip platform hazard scan");
      return;
    }
    const hazards = collectPlatformHazards(SANDBOX, REAL_WORLD_CATALOG);
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

  test("catalog packages require non-empty + expected exports (sandbox spawn)", async () => {
    if (!existsSync(path.join(SANDBOX, "node_modules"))) {
      console.log("sandbox node_modules missing — skip import surface");
      return;
    }

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

    // Property: random subsets of catalog names stay resolvable (cheap resolve check).
    const installed = REAL_WORLD_CATALOG.filter((e) => {
      try {
        Bun.resolveSync(e.name, SANDBOX);
        return true;
      } catch {
        return false;
      }
    });
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
  }, 120_000);

  test("LIBRARY_REGISTRY names match catalog shim references", () => {
    const known = new Set(LIBRARY_REGISTRY.map((s) => s.name));
    for (const entry of REAL_WORLD_CATALOG) {
      if (entry.shim) {
        expect(known.has(entry.shim)).toBe(true);
      }
    }
  });
});
