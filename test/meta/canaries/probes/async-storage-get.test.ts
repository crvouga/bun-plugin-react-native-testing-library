/**
 * Canary probe for async-storage Map fallback.
 * Uses the fallback path by mocking via the plugin when official jest mock is absent —
 * here we exercise the in-repo fallback factory directly.
 */

import { describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { asyncStorageShim } from "../../../../src/libraries/storage.ts";
import { resolveConfig } from "../../../../src/config.ts";

describe("canary probe: async-storage getItem", () => {
  test("Map fallback round-trips setItem/getItem", async () => {
    const cwd = join(import.meta.dir, ".tmp-as");
    rmSync(cwd, { recursive: true, force: true });
    mkdirSync(join(cwd, "node_modules", "@react-native-async-storage", "async-storage"), {
      recursive: true,
    });
    writeFileSync(
      join(cwd, "node_modules", "@react-native-async-storage", "async-storage", "package.json"),
      JSON.stringify({ name: "@react-native-async-storage/async-storage", main: "index.js" }),
    );
    writeFileSync(
      join(cwd, "node_modules", "@react-native-async-storage", "async-storage", "index.js"),
      "module.exports = {};",
    );

    // Register fallback (no ./jest mock present)
    asyncStorageShim.register({ cwd, config: resolveConfig({ debug: false }) });

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const AS = require(Bun.resolveSync("@react-native-async-storage/async-storage", cwd)) as {
      setItem: (k: string, v: string) => Promise<void>;
      getItem: (k: string) => Promise<string | null>;
      default?: { setItem: (k: string, v: string) => Promise<void>; getItem: (k: string) => Promise<string | null> };
    };
    const api = AS.default ?? AS;
    await api.setItem("k", "v");
    expect(await api.getItem("k")).toBe("v");
    rmSync(cwd, { recursive: true, force: true });
  });
});
