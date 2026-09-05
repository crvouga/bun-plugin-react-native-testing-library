/**
 * Canary probe: DEEP_PATHS processColor factory returns a callable.
 */

import { describe, expect, test } from "bun:test";
import { resolveConfig } from "../../../../src/config.ts";
import { DEEP_PATHS } from "../../../../src/mocks/index.ts";
import { createReactNativePublicAPI } from "../../../../src/mocks/react-native.ts";

describe("canary probe: deep-path processColor", () => {
  test("processColor factory is non-empty with default fn", () => {
    const api = createReactNativePublicAPI(resolveConfig({ platform: "ios" }));
    const factory = DEEP_PATHS["react-native/Libraries/StyleSheet/processColor"];
    expect(factory).toBeTruthy();
    const mod = factory!(api) as { default?: (c: unknown) => unknown; processColor?: (c: unknown) => unknown };
    expect(typeof (mod.default ?? mod.processColor)).toBe("function");
    expect(Object.keys(mod).length).toBeGreaterThan(0);
  });
});
