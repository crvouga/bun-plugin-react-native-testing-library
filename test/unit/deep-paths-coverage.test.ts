/**
 * Execute every DEEP_PATHS factory and surface helpers for coverage.
 */

import { describe, expect, test } from "bun:test";
import { resolveConfig } from "../../src/config.ts";
import { DEEP_PATHS, registerMocks } from "../../src/mocks/index.ts";
import { createReactNativePublicAPI } from "../../src/mocks/react-native.ts";
import {
  createNativeAnimatedHelper,
  createHostMocks,
  createNativeEventEmitter,
  createUIManager,
} from "../../src/mocks/surfaces.ts";
import { EventEmitter, NativeEventEmitter } from "../../src/mocks/events.ts";
import { AnimatedValue, AnimatedValueXY } from "../../src/mocks/animated.ts";

describe("deep paths + surfaces coverage", () => {
  test("every DEEP_PATHS factory returns a module shape", () => {
    const api = createReactNativePublicAPI(resolveConfig({ platform: "ios" }));
    for (const [specifier, factory] of Object.entries(DEEP_PATHS)) {
      const mod = factory(api);
      expect(mod).toBeTruthy();
      expect(specifier.startsWith("react-native")).toBe(true);
    }
  });

  test("registerMocks returns public API", () => {
    const api = registerMocks(resolveConfig({ debug: true }));
    expect(api.View).toBeTruthy();
    expect(api.Touchable).toBeTruthy();
  });

  test("EventEmitter / AnimatedValueXY / surfaces smoke", () => {
    const ee = new EventEmitter();
    const sub = ee.addListener("x", () => {});
    ee.emit("x");
    ee.once("y", () => {});
    ee.emit("y");
    ee.removeListener("x", () => {});
    sub.remove();
    ee.removeAllListeners();
    expect(ee.listenerCount("x")).toBe(0);

    const ne = new NativeEventEmitter();
    ne.removeListeners(1);

    const xy = new AnimatedValueXY({ x: 1, y: 2 });
    xy.setValue({ x: 3, y: 4 });
    xy.setOffset({ x: 0, y: 0 });
    xy.flattenOffset();
    xy.extractOffset();
    const id = xy.addListener(() => {});
    xy.removeListener(id);
    xy.removeAllListeners();
    xy.stopAnimation();
    xy.resetAnimation();
    expect(xy.getLayout()).toBeTruthy();
    expect(xy.getTranslateTransform().length).toBe(2);
    expect(xy.__getValue()).toEqual({ x: 3, y: 4 });

    const v = new AnimatedValue(0);
    v.setOffset(1);
    v.flattenOffset();
    v.extractOffset();
    v.stopAnimation();
    v.resetAnimation();

    expect(createNativeAnimatedHelper().shouldUseNativeDriver()).toBe(false);
    expect(createUIManager().getViewManagerConfig("AndroidDrawerLayout")).toBeTruthy();
    expect(createNativeEventEmitter()).toBeTruthy();
    expect(createHostMocks({ width: 1, height: 1, scale: 1, fontScale: 1 }).View).toBeTruthy();
  });
});
