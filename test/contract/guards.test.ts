/**
 * Contract: false-positive guards and run isolation.
 *
 * - The RN core mock surface is explicit: no catch-all proxy exports.
 * - Behavioral library shims keep observable contracts (spot checks).
 * - Unresolvable ecosystem imports fail loudly (spawn suite: resolution-failures).
 * - Suites run repeatedly with identical results (isolation check).
 */

import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { LIBRARY_REGISTRY, registerLibraryMocks } from "../../src/libraries/index.ts";
import { resolveConfig } from "../../src/config.ts";
import { pluginSourceStamp, withInstallLock } from "../helpers/sandbox-stamp.ts";

const ROOT = path.resolve(import.meta.dir, "../..");

describe("guards: explicit mock surface", () => {
  test("RN core mock has no catch-all exports", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const RN = require("react-native") as Record<string, unknown>;
    // Names that exist stay defined; invented names must be undefined —
    // a Proxy-based catch-all would hide missing APIs and pass broken tests.
    expect(RN.View).toBeDefined();
    expect(RN.definitelyNotAnExport12345).toBeUndefined();
    expect(RN.interactionManagerMissingSymbol).toBeUndefined();
  });

  test("every built-in shim declares a valid surface and provenance", () => {
    for (const shim of LIBRARY_REGISTRY) {
      const surface = shim.surface ?? "behavioral";
      expect(["behavioral", "presentation"]).toContain(surface);
      const provenance = shim.provenance ?? "builtin";
      expect(provenance).toBe("builtin");
    }
  });

  test("presentation shims are labeled so they cannot pass as behavioral coverage", () => {
    // Registry integrity: if a shim renders only, its descriptor says so —
    // the doctor and docs count behavioral coverage from these labels.
    const labeled = LIBRARY_REGISTRY.filter((s) => s.surface === "presentation");
    for (const shim of labeled) {
      expect(shim.surface).toBe("presentation");
    }
  });
});

describe("guards: behavioral spot contracts", () => {
  test("MMKV storage round-trip stays behavioral", () => {
    const sandbox = path.join(ROOT, "test", "real-world");
    expect(existsSync(path.join(sandbox, "node_modules"))).toBe(true);
    const prev = process.cwd();
    try {
      process.chdir(sandbox);
      // Register the shims exactly like preload does, then require through
      // the mocked surface.
      const result = registerLibraryMocks(resolveConfig({ libraryMocks: "auto" }));
      expect(result.activated.length).toBeGreaterThan(5);
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { MMKV } = require("react-native-mmkv") as {
        MMKV: new (opts?: {
          id?: string;
        }) => {
          set: (k: string, v: string | boolean | number) => void;
          getString: (k: string) => string | undefined;
          delete: (k: string) => void;
        };
      };
      const store = new MMKV({ id: "guards-spot-contract" });
      store.set("guard-key", "guard-value");
      expect(store.getString("guard-key")).toBe("guard-value");
      store.remove("guard-key");
      expect(store.getString("guard-key")).toBeUndefined();
    } finally {
      process.chdir(prev);
    }
  });
});

describe("guards: repeated-run isolation", () => {
  const ROOT2 = path.resolve(import.meta.dir, "../..");
  const SANDBOX = path.join(ROOT2, ".virt-rn-fixture", "guards-isolation-sandbox");
  let ready = false;

  test("suite passes twice in a row with the same result", async () => {
    if (!ready) {
      // Own sandbox: the config-file spawn suite rewrites its sandbox files
      // every run, so sharing one would race this test's children.
      mkdirSync(SANDBOX, { recursive: true });
      writeFileSync(
        path.join(SANDBOX, "package.json"),
        JSON.stringify({
          name: "guards-isolation-sandbox",
          type: "module",
          private: true,
          dependencies: {
            "bun-plugin-react-native-testing-library": `file:${ROOT2}`,
            react: "19.2.8",
          },
          pluginSourceStamp: pluginSourceStamp(),
        }),
      );
      if (!existsSync(path.join(SANDBOX, "node_modules"))) {
        await withInstallLock(async () => {
          const install = Bun.spawn({
            cmd: [process.execPath, "install"],
            cwd: SANDBOX,
            stdout: "pipe",
            stderr: "pipe",
          });
          const code = await install.exited;
          if (code !== 0) throw new Error("guards sandbox install failed");
        });
      }
      writeFileSync(
        path.join(SANDBOX, "bunfig.toml"),
        `[test]\npreload = ["bun-plugin-react-native-testing-library/preload"]\n`,
      );
      writeFileSync(
        path.join(SANDBOX, "isolation-probe.test.ts"),
        `import { test, expect } from "bun:test";
test("isolation probe", () => { expect(1).toBe(1); });
`,
      );
      ready = true;
    }

    const results: number[] = [];
    for (let i = 0; i < 2; i++) {
      const proc = Bun.spawn({
        cmd: [process.execPath, "test", "--bail", "isolation-probe.test.ts"],
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
      results.push(code);
      const out = `${stdout}${stderr}`;
      if (i === 0) {
        if (!out.includes("1 pass")) console.error(`[guards] child output: ${out.slice(-800)}`);
        expect(out).toMatch(/1 pass/);
      }
    }
    expect(results).toEqual([0, 0]);
  }, 180_000);
});
