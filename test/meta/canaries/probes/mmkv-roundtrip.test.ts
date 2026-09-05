/**
 * Canary probe: mmkv Map fallback set/get via shim on a temp cwd.
 */

import { describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { mmkvShim } from "../../../../src/libraries/skia-mmkv.ts";
import { resolveConfig } from "../../../../src/config.ts";
import { registerMocks } from "../../../../src/mocks/index.ts";

describe("canary probe: mmkv roundtrip", () => {
  test("set/get string", () => {
    const cwd = join(import.meta.dir, ".tmp-mmkv");
    rmSync(cwd, { recursive: true, force: true });
    mkdirSync(join(cwd, "node_modules", "react-native-mmkv"), { recursive: true });
    writeFileSync(
      join(cwd, "node_modules", "react-native-mmkv", "package.json"),
      JSON.stringify({ name: "react-native-mmkv", main: "index.js" }),
    );
    writeFileSync(join(cwd, "node_modules", "react-native-mmkv", "index.js"), "module.exports = {};");

    const prev = process.cwd();
    try {
      process.chdir(cwd);
      registerMocks(resolveConfig({ libraryMocks: false }));
      mmkvShim.register({ cwd, config: resolveConfig({ debug: false }) });
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { createMMKV } = require(Bun.resolveSync("react-native-mmkv", cwd)) as {
        createMMKV: (id?: string) => {
          set: (k: string, v: string) => void;
          getString: (k: string) => string | undefined;
          clearAll: () => void;
        };
      };
      const store = createMMKV("canary-mmkv");
      store.clearAll();
      store.set("k", "v");
      expect(store.getString("k")).toBe("v");
    } finally {
      process.chdir(prev);
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
