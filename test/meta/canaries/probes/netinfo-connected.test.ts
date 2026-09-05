/**
 * Canary probe: NetInfo fetch reports isConnected true by default.
 */

import { describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { netinfoShim } from "../../../../src/libraries/native-extras.ts";
import { resolveConfig } from "../../../../src/config.ts";
import { registerMocks } from "../../../../src/mocks/index.ts";

describe("canary probe: netinfo connected", () => {
  test("fetch().isConnected is true", async () => {
    const cwd = join(import.meta.dir, ".tmp-netinfo");
    rmSync(cwd, { recursive: true, force: true });
    mkdirSync(join(cwd, "node_modules", "@react-native-community", "netinfo"), { recursive: true });
    writeFileSync(
      join(cwd, "node_modules", "@react-native-community", "netinfo", "package.json"),
      JSON.stringify({ name: "@react-native-community/netinfo", main: "index.js" }),
    );
    writeFileSync(join(cwd, "node_modules", "@react-native-community", "netinfo", "index.js"), "module.exports = {};");

    const prev = process.cwd();
    try {
      process.chdir(cwd);
      registerMocks(resolveConfig({ libraryMocks: false }));
      netinfoShim.register({ cwd, config: resolveConfig({ debug: false }) });
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const NetInfo = require(Bun.resolveSync("@react-native-community/netinfo", cwd)) as {
        fetch: () => Promise<{ isConnected: boolean | null }>;
        default?: { fetch: () => Promise<{ isConnected: boolean | null }> };
      };
      const api = NetInfo.default ?? NetInfo;
      const s = await api.fetch();
      expect(s.isConnected).toBe(true);
    } finally {
      process.chdir(prev);
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
