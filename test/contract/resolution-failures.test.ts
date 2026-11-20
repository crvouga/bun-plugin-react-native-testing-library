/**
 * Contract: actionable resolution failures.
 *
 * Ecosystem-shaped specifiers that cannot resolve produce a structured error
 * naming the specifier, the importer, and the next action — never a silent
 * mock module. Non-ecosystem failures keep Bun's native error.
 */

import { describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { buildResolutionError, isEcosystemSpecifier } from "../../src/diagnostics.ts";
import { pluginSourceStamp, withInstallLock } from "../helpers/sandbox-stamp.ts";

describe("diagnostics: ecosystem shape detection", () => {
  test("react-native, expo, and community shapes qualify", () => {
    expect(isEcosystemSpecifier("react-native-fancy-view")).toBe(true);
    expect(isEcosystemSpecifier("react-native")).toBe(true);
    expect(isEcosystemSpecifier("expo-camera")).toBe(true);
    expect(isEcosystemSpecifier("@expo/prelude")).toBe(true);
    expect(isEcosystemSpecifier("@react-native-community/datetimepicker")).toBe(true);
    expect(isEcosystemSpecifier("@react-native/foo")).toBe(true);
  });

  test("non-ecosystem specifiers do not qualify", () => {
    expect(isEcosystemSpecifier("react")).toBe(false);
    expect(isEcosystemSpecifier("lodash")).toBe(false);
    expect(isEcosystemSpecifier("./local-file")).toBe(false);
    expect(isEcosystemSpecifier("@my-org/regular-pkg")).toBe(false);
    expect(isEcosystemSpecifier("expo")).toBe(false); // covered by core mocks
  });
});

describe("diagnostics: error message", () => {
  test("names specifier, importer, and the doctor command", () => {
    const err = buildResolutionError({
      specifier: "react-native-fancy-view",
      importer: "/app/src/screens/Home.tsx",
      disabledShims: [],
    });
    expect(err).toMatch(/Cannot resolve 'react-native-fancy-view'/);
    expect(err).toContain("Home.tsx");
    expect(err).toContain("bun-rn-doctor audit");
    expect(err).toMatch(/scaffold/);
  });

  test("names a disabled shim that would have covered the specifier", () => {
    const err = buildResolutionError({
      specifier: "react-native-reanimated",
      importer: "/app/src/x.ts",
      disabledShims: [{ name: "reanimated", packages: ["react-native-reanimated"] }],
    });
    expect(err).toMatch(/"reanimated"\) exists but is disabled/);
    expect(err).toMatch(/disabled/);
  });

  test("no [rn-bun] mock is offered: the error is terminal", () => {
    const err = buildResolutionError({
      specifier: "expo-haptics",
      importer: "/app/x.ts",
      disabledShims: [],
    });
    expect(err).not.toMatch(/mock\.module/);
  });
});

describe("diagnostics: integration under a real preload spawn", () => {
  const ROOT = path.resolve(import.meta.dir, "../..");
  const CACHE = path.join(ROOT, ".virt-rn-fixture", "diagnostics-sandbox");

  async function ensureSandbox(): Promise<void> {
    rmSync(CACHE, { recursive: true, force: true });
    mkdirSync(CACHE, { recursive: true });
    writeFileSync(
      path.join(CACHE, "package.json"),
      JSON.stringify({
        name: "diagnostics-sandbox",
        type: "module",
        private: true,
        dependencies: {
          "bun-plugin-react-native-testing-library": `file:${ROOT}`,
          react: "19.2.8",
        },
        pluginSourceStamp: pluginSourceStamp(),
      }),
    );
    await withInstallLock(async () => {
      const install = Bun.spawn({ cmd: [process.execPath, "install"], cwd: CACHE, stdout: "pipe", stderr: "pipe" });
      const code = await install.exited;
      if (code !== 0) {
        const err = await new Response(install.stderr).text();
        throw new Error(`diagnostics sandbox install failed: ${err.slice(-400)}`);
      }
    });
    writeFileSync(
      path.join(CACHE, "bunfig.toml"),
      `[test]\npreload = ["bun-plugin-react-native-testing-library/preload"]\n`,
    );
  }

  async function spawnProbe(): Promise<{ code: number; out: string }> {
    const proc = Bun.spawn({
      cmd: [process.execPath, "test", "--bail", "diag-probe.test.ts"],
      cwd: CACHE,
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env, FORCE_COLOR: "0" },
    });
    const [stdout, stderr, code] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    return { code, out: `${stdout}${stderr}` };
  }

  function writeProbe(importLine: string): void {
    writeFileSync(
      path.join(CACHE, "diag-probe.test.ts"),
      `import { test, expect } from "bun:test";
${importLine}
test("never runs", () => { expect(true).toBe(true); });
`,
    );
  }

  test("unresolvable ecosystem import fails with the structured error", async () => {
    await ensureSandbox();
    writeProbe(`import "react-native-fancy-view";`);
    const { code, out } = await spawnProbe();
    expect(code).not.toBe(0);
    expect(out).toMatch(/\[rn-bun\] Cannot resolve 'react-native-fancy-view'/);
    expect(out).toMatch(/bun-rn-doctor audit/);
  }, 180_000);

  test("non-ecosystem unresolvable import keeps Bun's native error", async () => {
    await ensureSandbox();
    writeProbe(`import "not-a-real-package-xyz";`);
    const { code, out } = await spawnProbe();
    expect(code).not.toBe(0);
    expect(out).not.toMatch(/\[rn-bun\] Cannot resolve/);
    expect(out).toMatch(/Could not resolve|Cannot find|MODULE_NOT_FOUND|not be resolved|resolve/i);
  }, 180_000);
});
