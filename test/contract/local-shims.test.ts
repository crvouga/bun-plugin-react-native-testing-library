/**
 * Contract: consumer-defined compatibility shims.
 *
 * - `defineShim` validation errors
 * - `rn-bun.config.ts` `compat.shims` loading through `loadConfig`
 * - registration through `registerCompat` and the preload path
 * - end-to-end: a local shim defined in a fixture config runs under a real
 *   `bun test --preload` spawn
 */

import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { defineShim } from "../../src/shim.ts";
import { loadConfig, resolveConfig } from "../../src/config.ts";
import { registerCompat } from "../../src/index.ts";
import { exampleLocalShim } from "../../examples/local-shim/example-shim.ts";
import { pluginSourceStamp, withInstallLock } from "../helpers/sandbox-stamp.ts";

const g = globalThis as typeof globalThis & Record<string, unknown>;

describe("contract: defineShim validation", () => {
  test("accepts a well-formed shim and returns it unchanged", () => {
    const shim = defineShim({
      name: "probe",
      packages: ["react"],
      register: () => {},
    });
    expect(shim.name).toBe("probe");
  });

  test("rejects empty name, empty packages, and missing register", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    expect(() => defineShim({ name: "", packages: ["react"], register: () => {} })).toThrow(/non-empty string/);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    expect(() => defineShim({ name: "x", packages: [], register: () => {} })).toThrow(/non-empty array/);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    expect(() => defineShim({ name: "x", packages: ["react"], register: undefined as never })).toThrow(
      /register must be a function/,
    );
  });

  test('rejects reserved "builtin" provenance', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    expect(() => defineShim({ name: "x", packages: ["react"], register: () => {}, provenance: "builtin" })).toThrow(
      /reserved/,
    );
  });
});

describe("contract: config-file compat loading", () => {
  test("loadConfig picks up compat.shims from rn-bun.config.ts in cwd", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "rn-compat-cfg-"));
    const prev = process.cwd();
    try {
      writeFileSync(
        path.join(dir, "rn-bun.config.ts"),
        `import { defineShim } from "${path.join(import.meta.dir, "../../src/shim.ts").replaceAll("\\", "/")}";
export default {
  compat: {
    shims: [defineShim({ name: "cfg-shim", packages: ["react"], register: () => {} })],
  },
};
`,
      );
      process.chdir(dir);
      const config = loadConfig();
      expect(config.compat.localShims.map((s) => s.name)).toEqual(["cfg-shim"]);
    } finally {
      process.chdir(prev);
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("invalid config shim throws naming rn-bun.config.ts", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "rn-compat-bad-"));
    const prev = process.cwd();
    try {
      writeFileSync(
        path.join(dir, "rn-bun.config.ts"),
        `export default { compat: { shims: [{ name: "broken", packages: ["react"] }] } };\n`,
      );
      process.chdir(dir);
      expect(() => loadConfig()).toThrow(/rn-bun\.config\.ts compat\.shims[\s\S]*Invalid shim/);
    } finally {
      process.chdir(prev);
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("no config file: compat is empty and loadConfig succeeds", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "rn-compat-none-"));
    const prev = process.cwd();
    try {
      process.chdir(dir);
      const config = loadConfig();
      expect(config.compat.localShims).toEqual([]);
      expect(config.compat.compatPackages).toEqual([]);
    } finally {
      process.chdir(prev);
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("contract: local shim registration", () => {
  test("registerCompat activates a local shim whose packages resolve", () => {
    const probe = `compat-activated:${Date.now()}`;
    const result = registerCompat({
      compat: {
        shims: [
          defineShim({
            name: "register-compat-probe",
            packages: ["react"],
            register: () => {
              g[probe] = true;
            },
          }),
        ],
      },
    });
    expect(result.activated).toContain("register-compat-probe");
    expect(g[probe]).toBe(true);
  });

  test("the example shim registers and activates against resolvable packages", () => {
    const result = registerCompat({ compat: { shims: [exampleLocalShim] } });
    expect(result.activated).toContain(exampleLocalShim.name);
  });
});

describe("contract: local shim under a real preload spawn", () => {
  const ROOT = path.resolve(import.meta.dir, "../..");
  const CACHE = path.join(ROOT, ".virt-rn-fixture", "compat-config-sandbox");

  async function ensureSandbox(): Promise<void> {
    mkdirSync(CACHE, { recursive: true });
    const pkgPath = path.join(CACHE, "package.json");
    const next = JSON.stringify(
      {
        name: "compat-config-sandbox",
        type: "module",
        private: true,
        dependencies: {
          "bun-plugin-react-native-testing-library": `file:${ROOT}`,
          react: "19.2.8",
          "react-native": "0.87.1",
          "@testing-library/react-native": "14.0.1",
          "test-renderer": "1.2.0",
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
          throw new Error(`compat sandbox install failed: ${err.slice(-400)}`);
        }
      });
    }
    writeFileSync(
      path.join(CACHE, "bunfig.toml"),
      `[test]\npreload = ["bun-plugin-react-native-testing-library/preload"]\n`,
    );
    writeFileSync(
      path.join(CACHE, "rn-bun.config.ts"),
      `import { defineShim } from "bun-plugin-react-native-testing-library";
export default {
  compat: {
    shims: [
      defineShim({
        name: "spawn-probe-shim",
        packages: ["react"],
        register: () => {
          (globalThis as any).__compatSpawnProbe = true;
        },
      }),
    ],
  },
};
`,
    );
    writeFileSync(
      path.join(CACHE, "compat-probe.test.ts"),
      `import { test, expect } from "bun:test";
test("local shim from rn-bun.config.ts registered via preload", () => {
  expect((globalThis as any).__compatSpawnProbe).toBe(true);
});
`,
    );
  }

  test("preload registers the config-file shim", async () => {
    await ensureSandbox();
    const proc = Bun.spawn({
      cmd: [process.execPath, "test", "--bail", "compat-probe.test.ts"],
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
    if (exitCode !== 0) console.error(out.slice(-1200));
    expect(exitCode).toBe(0);
    expect(out).toMatch(/1 pass/);
  }, 120_000);
});

describe("contract: resolveConfig carries compat", () => {
  test("compat defaults are empty", () => {
    const config = resolveConfig();
    expect(config.compat.localShims).toEqual([]);
    expect(config.compat.compatPackages).toEqual([]);
  });
});
