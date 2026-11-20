/**
 * Unit: compatibility doctor logic.
 *
 * The doctor plans the registry without registering (read-only audit), scans
 * consumer dependencies for uncovered native surfaces, and scaffolds starter
 * shims. CLI behavior is covered by the contract suite.
 */

import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { runDoctorAudit, scaffoldShim } from "../../src/doctor.ts";

const REAL_WORLD = path.resolve(import.meta.dir, "../../test/real-world");
const COMPAT_APP = path.resolve(import.meta.dir, "../../test/fixtures/compat-packages/app");

describe("doctor: audit", () => {
  test("plans shims read-only against the real-world sandbox", () => {
    const report = runDoctorAudit(REAL_WORLD);
    expect(report.bun).toBe(process.versions.bun);
    expect(report.cwd).toBe(REAL_WORLD);
    // Planned shims are reported without side effects: calling audit twice
    // yields the same plan (nothing was actually registered).
    const again = runDoctorAudit(REAL_WORLD);
    expect(again.shims).toEqual(report.shims);
    expect(report.shims.filter((s) => s.state === "planned").length).toBeGreaterThan(5);
  });

  test("coverage marks ecosystem deps shimmed, and uncovered deps are listed", () => {
    const uncoveredDir = mkdtempSync(path.join(tmpdir(), "doctor-uncovered-"));
    try {
      writeFileSync(
        path.join(uncoveredDir, "package.json"),
        JSON.stringify({
          dependencies: {
            react: "19.2.8",
            "react-native": "0.87.1",
            "react-native-fancy-view": "^1.0.0",
          },
        }),
      );
      const report = runDoctorAudit(uncoveredDir);
      const fancy = report.coverage.find((c) => c.dependency === "react-native-fancy-view");
      expect(fancy?.state).toBe("uncovered");
      const rn = report.coverage.find((c) => c.dependency === "react-native");
      expect(rn?.state).toBe("core");
      expect(report.uncovered).toContain("react-native-fancy-view");
    } finally {
      rmSync(uncoveredDir, { recursive: true, force: true });
    }
  });

  test("audit includes compat shims declared in rn-bun.config.ts", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "doctor-cfgfile-"));
    try {
      writeFileSync(
        path.join(dir, "package.json"),
        JSON.stringify({ name: "cfgfile-app", dependencies: { react: "19.2.8" } }),
      );
      writeFileSync(
        path.join(dir, "rn-bun.config.ts"),
        `export default { compat: { shims: [{ name: "cfg-file-shim", packages: ["react"], register: () => {} }] } };\n`,
      );
      // The shim activates only when its packages resolve from the audit dir.
      mkdirSync(path.join(dir, "node_modules"), { recursive: true });
      symlinkSync(
        path.resolve(import.meta.dir, "../../node_modules/react"),
        path.join(dir, "node_modules", "react"),
        "dir",
      );
      const report = runDoctorAudit(dir);
      const row = report.shims.find((s) => s.name === "cfg-file-shim");
      // The audit must reflect what the preload would register: the config
      // file's local shims are planned, not silently absent.
      expect(row?.state).toBe("planned");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("compat package load errors surface in the report", () => {
    const report = runDoctorAudit(COMPAT_APP);
    const probe = report.packages.find((p) => p.name === "bun-rn-compat-probe");
    expect(probe?.loaded).toBe(true);
    expect(probe?.shims).toContain("probe-package-shim");
  });
});

describe("doctor: scaffold", () => {
  test("writes a starter shim and refuses to overwrite", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "doctor-scaffold-"));
    try {
      const written = scaffoldShim("react-native-fancy-view", dir);
      expect(existsSync(written.path)).toBe(true);
      const contents = readFileSync(written.path, "utf8");
      expect(contents).toContain("defineShim");
      expect(contents).toContain("react-native-fancy-view");
      expect(() => scaffoldShim("react-native-fancy-view", dir)).toThrow(/already exists/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("scoped package names map to nested files", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "doctor-scaffold2-"));
    try {
      const written = scaffoldShim("@my-org/some-native-thing", dir);
      expect(written.path).toContain(path.join("rn-bun.shims", "@my-org", "some-native-thing.ts"));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
