/**
 * Canary probe: FlashList renders all rows.
 */

import { describe, expect, test } from "bun:test";
import type * as React from "react";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { Text } from "react-native";
import { render } from "@testing-library/react-native";
import { flashListShim } from "../../../../src/libraries/native-extras.ts";
import { resolveConfig } from "../../../../src/config.ts";
import { registerMocks } from "../../../../src/mocks/index.ts";

describe("canary probe: flash-list row count", () => {
  test("renders every data row", async () => {
    const cwd = join(import.meta.dir, ".tmp-flash");
    rmSync(cwd, { recursive: true, force: true });
    mkdirSync(join(cwd, "node_modules", "@shopify", "flash-list"), { recursive: true });
    writeFileSync(
      join(cwd, "node_modules", "@shopify", "flash-list", "package.json"),
      JSON.stringify({ name: "@shopify/flash-list", main: "index.js" }),
    );
    writeFileSync(join(cwd, "node_modules", "@shopify", "flash-list", "index.js"), "module.exports = {};");

    const prev = process.cwd();
    try {
      process.chdir(cwd);
      registerMocks(resolveConfig({ libraryMocks: false }));
      flashListShim.register({ cwd, config: resolveConfig({ debug: false }) });
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { FlashList } = require(Bun.resolveSync("@shopify/flash-list", cwd)) as {
        FlashList: React.ComponentType<Record<string, unknown>>;
      };
      const data = ["a", "b", "c"];
      const screen = await render(
        <FlashList
          testID="flash"
          data={data}
          estimatedItemSize={40}
          renderItem={({ item, index }: { item: string; index: number }) => <Text testID={`row-${index}`}>{item}</Text>}
        />,
      );
      expect(screen.getByTestId("row-0")).toBeTruthy();
      expect(screen.getByTestId("row-1")).toBeTruthy();
      expect(screen.getByTestId("row-2")).toBeTruthy();
      await screen.unmount();
    } finally {
      process.chdir(prev);
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
