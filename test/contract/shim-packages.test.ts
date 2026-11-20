/**
 * Contract: npm-distributed compatibility shim packages.
 *
 * - discovery: `bun-rn-compat-*` dependencies activate without app code;
 *   explicit `compatPackages` entries are honored and win ordering
 * - loading: `<pkg>/shim` export (fallback: package root) provides shims;
 *   a package without the export is a reported error, never a silent skip
 */

import { describe, expect, test, beforeAll } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { discoverCompatPackages, loadCompatPackageShims } from "../../src/compat-packages.ts";
import { registerCompat } from "../../src/index.ts";

import { pluginSourceStamp, withInstallLock } from "../helpers/sandbox-stamp.ts";

describe("contract: compat package discovery", () => {
  test("finds bun-rn-compat-* dependencies and devDependencies", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "compat-discover-"));
    try {
      writeFileSync(
        path.join(dir, "package.json"),
        JSON.stringify({
          dependencies: { "bun-rn-compat-fancy": "^1.0.0", react: "19.2.8" },
          devDependencies: { "bun-rn-compat-exotic": "^2.0.0" },
        }),
      );
      expect(discoverCompatPackages(dir)).toEqual(["bun-rn-compat-fancy", "bun-rn-compat-exotic"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("explicit compatPackages entries come first and need no naming pattern", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "compat-discover2-"));
    try {
      writeFileSync(
        path.join(dir, "package.json"),
        JSON.stringify({ dependencies: { "bun-rn-compat-fancy": "^1.0.0" } }),
      );
      expect(discoverCompatPackages(dir, ["@my-org/compat-shims"])).toEqual([
        "@my-org/compat-shims",
        "bun-rn-compat-fancy",
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("no package.json: only explicit entries", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "compat-discover3-"));
    try {
      expect(discoverCompatPackages(dir, ["@my-org/compat-shims"])).toEqual(["@my-org/compat-shims"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("contract: compat package loading", () => {
  const FIXTURES = path.join(import.meta.dir, "../fixtures/compat-packages");

  test("loads shims from the ./shim export", () => {
    const loaded = loadCompatPackageShims("bun-rn-compat-probe", FIXTURES);
    expect(loaded.errors).toEqual([]);
    expect(loaded.shims.map((s) => s.name)).toEqual(["probe-package-shim"]);
  });

  test("a package without a shim export is a reported error, not a silent skip", () => {
    const loaded = loadCompatPackageShimSafe("bun-rn-compat-empty", FIXTURES);
    expect(loaded.shims).toEqual([]);
    expect(loaded.errors[0]).toMatch(/did not export an array of shims/);
  });
});

// Wrapper so a package that cannot resolve at all does not crash the test on
// require of a bare specifier falling back to cwd resolution.
function loadCompatPackageShimSafe(name: string, cwd: string) {
  try {
    return loadCompatPackageShims(name, cwd);
  } catch (err) {
    return { name, shims: [], errors: [err instanceof Error ? err.message : String(err)] };
  }
}

describe("contract: compat package under a real preload spawn", () => {
  const ROOT = path.resolve(import.meta.dir, "../..");
  const CACHE = path.join(ROOT, ".virt-rn-fixture", "compat-pkg-sandbox");

  test("installed bun-rn-compat-* dep activates with no app code", async () => {
    mkdirSync(CACHE, { recursive: true });
    const pkgPath = path.join(CACHE, "package.json");
    const next = JSON.stringify(
      {
        name: "compat-pkg-sandbox",
        type: "module",
        private: true,
        dependencies: {
          "bun-plugin-react-native-testing-library": `file:${ROOT}`,
          react: "19.2.8",
          "react-native": "0.87.1",
          "@testing-library/react-native": "14.0.1",
          "test-renderer": "1.2.0",
          "bun-rn-compat-probe": `file:${path.join(import.meta.dir, "../fixtures/compat-packages/node_modules/bun-rn-compat-probe")}`,
        },
        pluginSourceStamp: pluginSourceStamp(),
      },
      null,
      2,
    );
    const prev = existsSync(pkgPath) ? readFileSync(pkgPath, "utf8") : "";
    writeFileSync(pkgPath, next);
    if (!existsSync(path.join(CACHE, "node_modules")) || prev !== next) {
      await withInstallLock(async () => {
        const install = Bun.spawn({ cmd: [process.execPath, "install"], cwd: CACHE, stdout: "pipe", stderr: "pipe" });
        const code = await install.exited;
        if (code !== 0) {
          const err = await new Response(install.stderr).text();
          throw new Error(`compat-pkg sandbox install failed: ${err.slice(-400)}`);
        }
      });
    }
    writeFileSync(
      path.join(CACHE, "bunfig.toml"),
      `[test]\npreload = ["bun-plugin-react-native-testing-library/preload"]\n`,
    );
    // No rn-bun.config.ts — activation must come purely from the dependency.
    writeFileSync(
      path.join(CACHE, "pkg-probe.test.ts"),
      `import { test, expect } from "bun:test";
test("compat package shim registered via preload discovery", () => {
  expect((globalThis as any).__compatPkgProbe).toBe(true);
});
`,
    );
    const proc = Bun.spawn({
      cmd: [process.execPath, "test", "--bail", "pkg-probe.test.ts"],
      cwd: CACHE,
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env, FORCE_COLOR: "0" },
    });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    const out = `${stdout}${stderr}`;
    if (exitCode !== 0) console.error(out.slice(-1500));
    expect(exitCode).toBe(0);
    expect(out).toMatch(/1 pass/);
  }, 180_000);
});

const SANDBOX = path.join(import.meta.dir, "../fixtures/compat-packages/app");

describe("registerCompat: installed package activates", () => {
  beforeAll(async () => {
    mkdirSync(SANDBOX, { recursive: true });
    writeFileSync(
      path.join(SANDBOX, "package.json"),
      JSON.stringify(
        {
          name: "compat-packages-app",
          type: "module",
          private: true,
          dependencies: {
            react: "19.2.8",
            "bun-rn-compat-probe": `file:${path.join(import.meta.dir, "../fixtures/compat-packages/node_modules/bun-rn-compat-probe")}`,
          },
        },
        null,
        2,
      ),
    );
    await withInstallLock(async () => {
      const install = Bun.spawn({ cmd: [process.execPath, "install"], cwd: SANDBOX, stdout: "pipe", stderr: "pipe" });
      const code = await install.exited;
      if (code !== 0) {
        const err = await new Response(install.stderr).text();
        throw new Error(`compat-packages app install failed: ${err.slice(-400)}`);
      }
    });
  });

  test("shim from an installed bun-rn-compat-* dependency activates via registerCompat", () => {
    const prev = process.cwd();
    try {
      process.chdir(SANDBOX);
      const g = globalThis as typeof globalThis & Record<string, unknown>;
      const result = registerCompat();
      expect(result.activated).toContain("probe-package-shim");
      expect(g.__compatPkgProbe).toBe(true);
    } finally {
      process.chdir(prev);
    }
  });
});
