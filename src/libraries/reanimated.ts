import type { LibraryShim } from "./helpers.ts";
import { mockBoth, tryRequire } from "./helpers.ts";

function fallbackReanimated() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const RN = require("react-native") as typeof import("react-native");
  const makeShared = (init: unknown) => {
    const obj = {
      value: init,
      get: () => (obj as { value: unknown }).value,
      set: (v: unknown) => {
        (obj as { value: unknown }).value = v;
      },
    };
    return obj;
  };
  const Animated = {
    View: RN.View,
    Text: RN.Text,
    Image: RN.Image,
    ScrollView: RN.ScrollView,
    FlatList: RN.FlatList,
    createAnimatedComponent: <T>(c: T) => c,
  };
  // Mutable object — gesture-handler assigns Reanimated.setGestureState
  const api: Record<string, unknown> = {
    default: Animated,
    ...Animated,
    useSharedValue: makeShared,
    useAnimatedStyle: (fn: () => unknown) => fn(),
    useDerivedValue: (fn: () => unknown) => makeShared(fn()),
    useAnimatedRef: () => ({ current: null }),
    useAnimatedScrollHandler: () => ({}),
    useAnimatedReaction: () => {},
    useAnimatedProps: (fn: () => unknown) => fn(),
    withTiming: (to: unknown) => to,
    withSpring: (to: unknown) => to,
    withDelay: (_d: number, v: unknown) => v,
    withSequence: (...vals: unknown[]) => vals[vals.length - 1],
    withRepeat: (v: unknown) => v,
    cancelAnimation: () => {},
    runOnJS: (fn: Function) => fn,
    runOnUI: (fn: Function) => fn,
    interpolate: (v: number) => v,
    Extrapolation: { CLAMP: "clamp", EXTEND: "extend", IDENTITY: "identity" },
    Easing: RN.Easing,
    FadeIn: {},
    FadeOut: {},
    Layout: {},
    ZoomIn: {},
    ZoomOut: {},
    SlideInRight: {},
    SlideOutLeft: {},
    setGestureState: () => {},
  };
  return api;
}

export const reanimatedShim: LibraryShim = {
  name: "reanimated",
  packages: ["react-native-reanimated"],
  register({ cwd, config }) {
    const factory = () => {
      // Prefer our mutable fallback — official mock can be non-extensible and
      // gesture-handler assigns Reanimated.setGestureState on import.
      void tryRequire;
      if (config.debug) {
        console.log("[rn-bun] reanimated: using mutable fallback shim");
      }
      return fallbackReanimated();
    };
    mockBoth("react-native-reanimated", factory, cwd);
    mockBoth("react-native-reanimated/package.json", () => ({ name: "react-native-reanimated" }), cwd);
  },
};

export const workletsShim: LibraryShim = {
  name: "worklets",
  packages: ["react-native-worklets"],
  register({ cwd, config }) {
    const factory = () => {
      const official =
        tryRequire("react-native-worklets/src/mock", cwd) ?? tryRequire("react-native-worklets/lib/module/mock", cwd);
      if (official) return official;
      if (config.debug) {
        console.warn("[rn-bun] worklets mock missing; using JS fallback");
      }
      return {
        runOnJS: (fn: Function) => fn,
        runOnUI: (fn: Function) => fn,
        createWorkletRuntime: () => ({}),
        scheduleOnRN: (fn: Function, ...args: unknown[]) => fn(...args),
        scheduleOnUI: (fn: Function, ...args: unknown[]) => fn(...args),
        isWorkletFunction: () => false,
        callMicrotasks: () => {},
      };
    };
    mockBoth("react-native-worklets", factory, cwd);
  },
};
