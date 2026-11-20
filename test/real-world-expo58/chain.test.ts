/**
 * SDK 58: native-module chain + RN 0.88 removal behavior.
 *
 * - InteractionManager was REMOVED from RN 0.88; the compat mock keeps a
 *   functional surface so libraries that still import it do not crash, and
 *   new code can use requestIdleCallback.
 * - Unshimmed Expo modules resolve through the native-module chain.
 */
import { describe, expect, test } from "bun:test";
import { InteractionManager, requestIdleCallback } from "react-native";
import { requireNativeModule } from "expo-modules-core";
import * as FileSystem from "expo-file-system";

describe("expo58 native chain", () => {
  test("legacy InteractionManager import keeps working under RN 0.88", async () => {
    expect(typeof InteractionManager.runAfterInteractions).toBe("function");
    await expect(
      new Promise<void>((resolve) => InteractionManager.runAfterInteractions(() => resolve())),
    ).resolves.toBeUndefined();
  });

  test("requestIdleCallback is exported for post-removal code", () => {
    expect(typeof requestIdleCallback).toBe("function");
    const id = requestIdleCallback(() => {});
    expect(id != null).toBe(true);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { cancelIdleCallback } = require("react-native") as { cancelIdleCallback: (id: number) => void };
    cancelIdleCallback(id as unknown as number);
  });

  test("unshimmed expo module resolves and behaves", async () => {
    const haptics = requireNativeModule("ExpoHaptics");
    expect(haptics).toBeTruthy();
    const constants = requireNativeModule("ExpoConstants");
    expect(constants).toBeTruthy();
  });

  test("expo-file-system surface works", async () => {
    expect(typeof FileSystem.documentDirectory).toBe("string");
  });
});
