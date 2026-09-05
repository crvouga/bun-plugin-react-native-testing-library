/**
 * Canary probe: Clipboard set/get round-trip.
 */

import { describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { clipboardShim } from "../../../../src/libraries/native-extras.ts";
import { resolveConfig } from "../../../../src/config.ts";

describe("canary probe: clipboard round-trip", () => {
  test("setString/getString", async () => {
    const cwd = join(import.meta.dir, ".tmp-clip");
    rmSync(cwd, { recursive: true, force: true });
    mkdirSync(join(cwd, "node_modules", "@react-native-clipboard", "clipboard"), { recursive: true });
    writeFileSync(
      join(cwd, "node_modules", "@react-native-clipboard", "clipboard", "package.json"),
      JSON.stringify({ name: "@react-native-clipboard/clipboard", main: "index.js" }),
    );
    writeFileSync(
      join(cwd, "node_modules", "@react-native-clipboard", "clipboard", "index.js"),
      "module.exports = {};",
    );

    clipboardShim.register({ cwd, config: resolveConfig({ debug: false }) });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Clip = require(Bun.resolveSync("@react-native-clipboard/clipboard", cwd)) as {
      setString: (v: string) => Promise<void>;
      getString: () => Promise<string>;
      default?: { setString: (v: string) => Promise<void>; getString: () => Promise<string> };
    };
    const api = Clip.default ?? Clip;
    await api.setString("hello");
    expect(await api.getString()).toBe("hello");
    rmSync(cwd, { recursive: true, force: true });
  });
});
