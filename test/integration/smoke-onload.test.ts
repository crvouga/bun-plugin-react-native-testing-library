/**
 * Smoke probe for the Bun node_modules `onLoad` pitfall (oven-sh/bun#10083).
 *
 * Findings on Bun 1.4.0 (recorded in smoke-onload-result.json):
 * - Direct onLoad filter DOES fire for node_modules paths, but the returned
 *   contents are ignored → empty/undefined module exports (the #10083 bug).
 * - Bare package specifiers do NOT trigger runtime onResolve.
 * - Therefore the plugin defaults to strategy "namespace" for any residual
 *   deep RN loads, and uses mock.module("react-native") for the public API.
 */

import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const ROOT = path.resolve(import.meta.dir, "../..");
const workDir = mkdtempSync(path.join(tmpdir(), "rn-bun-smoke-"));

afterAll(() => {
  try {
    rmSync(workDir, { recursive: true, force: true });
  } catch {
    // ignore
  }
});

function writeTree() {
  const fixture = path.join(workDir, "node_modules", "fixture-pkg");
  mkdirSync(path.join(fixture, "lib"), { recursive: true });
  writeFileSync(path.join(fixture, "package.json"), JSON.stringify({ name: "fixture-pkg", main: "index.js" }));
  writeFileSync(
    path.join(fixture, "index.js"),
    `const native = require("./lib/native");
module.exports = { value: "ORIGINAL", native: native.name || native.default || native };
`,
  );
  writeFileSync(
    path.join(fixture, "lib", "native.js"),
    `module.exports = { name: "REAL_NATIVE" };
`,
  );

  writeFileSync(
    path.join(workDir, "preload.ts"),
    `
import { plugin } from "bun";
import { readFileSync } from "node:fs";
import path from "node:path";

const log: string[] = [];
(globalThis as any).__SMOKE_LOG__ = log;

plugin({
  name: "smoke-probe",
  setup(build) {
    build.onResolve({ filter: /.*/ }, (args) => {
      log.push("resolve:" + args.path);
      return undefined;
    });
    build.onLoad({ filter: /node_modules\\/fixture-pkg\\/.*\\.js$/ }, (args) => {
      log.push("direct-load:" + path.basename(args.path));
      const src = readFileSync(args.path, "utf8").replace("ORIGINAL", "TRANSFORMED");
      return { contents: src, loader: "js" };
    });
  },
});
`,
  );

  writeFileSync(path.join(workDir, "bunfig.toml"), `[test]\npreload = ["./preload.ts"]\n`);

  writeFileSync(
    path.join(workDir, "smoke.test.ts"),
    `
import { test } from "bun:test";

test("probe onLoad", () => {
  let mod: any = null;
  let loadError: string | null = null;
  try {
    mod = require("fixture-pkg");
  } catch (e: any) {
    loadError = e?.message ?? String(e);
  }
  const log: string[] = (globalThis as any).__SMOKE_LOG__ ?? [];
  const result = {
    value: mod?.value,
    native: mod?.native,
    loadError,
    directLoadFired: log.some((l) => l.startsWith("direct-load:")),
    resolveBare: log.some((l) => l === "resolve:fixture-pkg"),
    resolveRelative: log.some((l) => l.includes("resolve:./lib/native")),
    log,
  };
  console.log("SMOKE_RESULT=" + JSON.stringify(result));
});
`,
  );
}

describe("smoke: Bun node_modules onLoad pitfall", () => {
  test("probe direct onLoad behaviour and record strategy", async () => {
    writeTree();
    const proc = Bun.spawn({
      cmd: [process.execPath, "test", "smoke.test.ts"],
      cwd: workDir,
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env, BUN_CONFIG_NO_CLEAR_TERMINAL_ON_RELOAD: "1" },
    });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);

    const combined = stdout + "\n" + stderr;
    const match = combined.match(/SMOKE_RESULT=(\{.*\})/);
    expect(match).toBeTruthy();
    const result = JSON.parse(match![1]!) as {
      value: unknown;
      native: unknown;
      loadError: string | null;
      directLoadFired: boolean;
      resolveBare: boolean;
      resolveRelative: boolean;
      log: string[];
    };

    // Direct onLoad "works" only if it both fired AND the export was transformed.
    const transformed = result.directLoadFired && result.value === "TRANSFORMED";
    const finding = {
      bunVersion: Bun.version,
      directOnLoadCallbackFired: result.directLoadFired,
      directOnLoadTransformsNodeModules: transformed,
      observedValue: result.value ?? null,
      observedNative: result.native ?? null,
      loadError: result.loadError,
      onResolveBare: result.resolveBare,
      onResolveRelative: result.resolveRelative,
      recommendedStrategy: transformed ? "direct" : "namespace",
      primaryPublicApiStrategy: 'mock.module("react-native")',
      notes: [
        "On Bun 1.4.0, onLoad for node_modules paths fires but returned contents are ignored (empty/undefined exports) — oven-sh/bun#10083.",
        "Bare package specifiers skip runtime onResolve (could_be_plugin gate).",
        "Therefore this plugin mocks the public react-native entry via mock.module and uses namespace rewrite for residual deep loads.",
      ],
      exitCode,
    };

    mkdirSync(path.join(ROOT, "test", "integration"), { recursive: true });
    writeFileSync(
      path.join(ROOT, "test", "integration", "smoke-onload-result.json"),
      JSON.stringify(finding, null, 2) + "\n",
    );

    console.log("SMOKE_FINDING=", JSON.stringify(finding, null, 2));

    expect(finding.recommendedStrategy).toBe("namespace");
    expect(finding.directOnLoadTransformsNodeModules).toBe(false);
  }, 60_000);
});
