/**
 * Canary probe: keychain set/get round-trip via shim registration on a temp cwd.
 */

import { describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { keychainShim, __resetKeychainForTests } from "../../../../src/libraries/ecosystem.ts";
import { resolveConfig } from "../../../../src/config.ts";
import { registerMocks } from "../../../../src/mocks/index.ts";

describe("canary probe: keychain roundtrip", () => {
  test("set/get generic password", async () => {
    const cwd = join(import.meta.dir, ".tmp-keychain");
    rmSync(cwd, { recursive: true, force: true });
    mkdirSync(join(cwd, "node_modules", "react-native-keychain"), { recursive: true });
    writeFileSync(
      join(cwd, "node_modules", "react-native-keychain", "package.json"),
      JSON.stringify({ name: "react-native-keychain", main: "index.js" }),
    );
    writeFileSync(join(cwd, "node_modules", "react-native-keychain", "index.js"), "module.exports = {};");

    const prev = process.cwd();
    try {
      process.chdir(cwd);
      __resetKeychainForTests();
      registerMocks(resolveConfig({ libraryMocks: false }));
      keychainShim.register({ cwd, config: resolveConfig({ debug: false }) });
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Keychain = require(Bun.resolveSync("react-native-keychain", cwd)) as {
        setGenericPassword: (u: string, p: string) => Promise<boolean>;
        getGenericPassword: () => Promise<false | { username: string; password: string }>;
        resetGenericPassword: () => Promise<boolean>;
      };
      await Keychain.resetGenericPassword();
      await Keychain.setGenericPassword("alice", "s3cret");
      const creds = await Keychain.getGenericPassword();
      expect(creds).not.toBe(false);
      if (creds !== false) {
        expect(creds.username).toBe("alice");
        expect(creds.password).toBe("s3cret");
      }
    } finally {
      process.chdir(prev);
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
