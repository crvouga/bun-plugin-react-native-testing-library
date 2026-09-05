/**
 * Meta: bun check stage manifest must stay complete and fail-closed.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CHECK_STAGES, RELEASE_READY_SENTINEL, REPORT_PATH } from "../../../scripts/check-manifest.ts";

const ROOT = join(import.meta.dir, "../../..");

describe("meta: release gate manifest", () => {
  test("required stages are present and scripts exist", () => {
    const ids = CHECK_STAGES.map((s) => s.id);
    for (const required of [
      "bootstrap-fixtures",
      "format",
      "lint",
      "typecheck",
      "verify-package",
      "compat-matrix",
      "differential-oracle",
      "tests",
      "walks",
      "coverage-manifest",
      "canaries",
    ]) {
      expect(ids).toContain(required);
    }

    for (const stage of CHECK_STAGES) {
      expect(stage.argv.length).toBeGreaterThan(0);
      // Script path stages must exist on disk
      const script = stage.argv.find((a) => a.startsWith("scripts/"));
      if (script) {
        expect(existsSync(join(ROOT, script))).toBe(true);
      }
    }
  });

  test("package.json check invokes scripts/check.ts", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts.check).toContain("scripts/check.ts");
    expect(pkg.scripts["check:full"]).toMatch(/bun check|scripts\/check\.ts/);
  });

  test("sentinel and report path are stable", () => {
    expect(RELEASE_READY_SENTINEL).toBe("RELEASE READY: bun check passed");
    expect(REPORT_PATH).toBe("compat/release-report.json");
  });
});
