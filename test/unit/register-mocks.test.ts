import { describe, expect, test } from "bun:test";
import { resolveConfig } from "../../src/config.ts";
import { registerMocks } from "../../src/mocks/index.ts";
import { getScreen } from "../../src/screen.ts";

describe("registerMocks + getScreen", () => {
  test("registerMocks is idempotent enough to call again", () => {
    registerMocks(resolveConfig({ platform: "ios" }));
    // Re-importing react-native should yield the mock
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const RN = require("react-native") as { Platform: { OS: string }; View: unknown };
    expect(RN.Platform.OS).toBe("ios");
    expect(RN.View).toBeTruthy();
  });

  test("getScreen returns the live RNTL screen export", () => {
    const screen = getScreen();
    expect(screen).toBeTruthy();
  });
});
