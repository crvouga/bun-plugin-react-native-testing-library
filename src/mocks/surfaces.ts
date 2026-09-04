/**
 * Remaining native-surface mock factories (UIManager, TurboModuleRegistry, etc.).
 */

import type { WindowMetrics } from "../config.ts";
import { createHostComponent, noop } from "./host.ts";

export function createUIManager() {
  return {
    AndroidViewPager: {
      Commands: { setPage: noop, setPageWithoutAnimation: noop },
    },
    blur: noop,
    createView: noop,
    customBubblingEventTypes: {},
    customDirectEventTypes: {},
    dispatchViewManagerCommand: noop,
    focus: noop,
    getViewManagerConfig: (name: string) => {
      if (name === "AndroidDrawerLayout") {
        return { Constants: { DrawerPosition: { Left: 10 } } };
      }
      return { Constants: {} };
    },
    hasViewManagerConfig: (name: string) => name === "AndroidDrawerLayout",
    measure: noop,
    measureInWindow: noop,
    measureLayout: noop,
    manageChildren: noop,
    setChildren: noop,
    updateView: noop,
    AndroidDrawerLayout: { Constants: { DrawerPosition: { Left: 10 } } },
    AndroidTextInput: { Commands: {} },
    ScrollView: { Constants: {} },
    View: { Constants: {} },
  };
}

export function createTurboModuleRegistry(nativeModules: Record<string, unknown>) {
  const cache = new Map<string, unknown>();
  return {
    get<T>(name: string): T | null {
      if (cache.has(name)) return cache.get(name) as T;
      const mod = nativeModules[name] ?? null;
      if (mod) cache.set(name, mod);
      return mod as T | null;
    },
    getEnforcing<T>(name: string): T {
      const mod = this.get<T>(name);
      if (mod == null) {
        const proxy = new Proxy(
          {},
          {
            get: (_t, prop) => {
              if (prop === "getConstants") return () => ({});
              return noop;
            },
          },
        );
        cache.set(name, proxy);
        return proxy as T;
      }
      return mod;
    },
  };
}

export function createNativeEventEmitter() {
  return class NativeEventEmitter {
    addListener(_event: string, _handler: (...args: unknown[]) => void) {
      return { remove: noop };
    }
    removeListeners(_count: number) {}
    removeAllListeners(_event?: string) {}
    emit(_event: string, ..._args: unknown[]) {}
    listenerCount(_event: string) {
      return 0;
    }
  };
}

export function createPixelRatio() {
  return {
    get: () => 3,
    getFontScale: () => 1,
    getPixelSizeForLayoutSize: (size: number) => Math.round(size * 3),
    roundToNearestPixel: (size: number) => Math.round(size * 3) / 3,
    startDetecting: noop,
  };
}

export function createAppearance() {
  let scheme: "light" | "dark" | null = "light";
  const listeners = new Set<(prefs: { colorScheme: typeof scheme }) => void>();
  return {
    getColorScheme: () => scheme,
    setColorScheme: (s: typeof scheme) => {
      scheme = s;
      for (const l of listeners) l({ colorScheme: scheme });
    },
    addChangeListener: (handler: (prefs: { colorScheme: typeof scheme }) => void) => {
      listeners.add(handler);
      return { remove: () => listeners.delete(handler) };
    },
  };
}

export function createSettings() {
  const store = new Map<string, unknown>();
  return {
    get: (key: string) => store.get(key),
    set: (settings: Record<string, unknown>) => {
      for (const [k, v] of Object.entries(settings)) store.set(k, v);
    },
    watchKeys: (_keys: string | string[], _callback: () => void) => 0,
    clearWatch: (_id: number) => {},
  };
}

export function createAccessibilityInfo() {
  return {
    isBoldTextEnabled: () => Promise.resolve(false),
    isGrayscaleEnabled: () => Promise.resolve(false),
    isInvertColorsEnabled: () => Promise.resolve(false),
    isReduceMotionEnabled: () => Promise.resolve(false),
    isReduceTransparencyEnabled: () => Promise.resolve(false),
    isScreenReaderEnabled: () => Promise.resolve(false),
    isDarkerSystemColorsEnabled: () => Promise.resolve(false),
    isHighTextContrastEnabled: () => Promise.resolve(false),
    prefersCrossFadeTransitions: () => Promise.resolve(false),
    announceForAccessibility: noop,
    announceForAccessibilityWithOptions: noop,
    setAccessibilityFocus: noop,
    getRecommendedTimeoutMillis: (ms: number) => Promise.resolve(ms),
    addEventListener: () => ({ remove: noop }),
  };
}

export function createInteractionManager() {
  return {
    runAfterInteractions: (task?: (() => void) | { gen?: () => Promise<void>; name?: string }) => {
      const handle = { cancel: noop };
      Promise.resolve().then(() => {
        if (typeof task === "function") task();
        else if (task?.gen) void task.gen();
      });
      return handle;
    },
    createInteractionHandle: () => 1,
    clearInteractionHandle: noop,
    setDeadline: noop,
  };
}

export function createAppState() {
  return {
    currentState: "active" as string,
    isAvailable: true,
    addEventListener: () => ({ remove: noop }),
  };
}

export function createLinking() {
  return {
    addEventListener: () => ({ remove: noop }),
    openURL: (url: string) => Promise.resolve(url.length > 0),
    canOpenURL: () => Promise.resolve(true),
    openSettings: () => Promise.resolve(),
    getInitialURL: () => Promise.resolve(null),
    sendIntent: () => Promise.resolve(),
  };
}

export function createVibration() {
  return { vibrate: noop, cancel: noop };
}

export function createClipboard() {
  let content = "";
  return {
    getString: () => Promise.resolve(content),
    setString: (text: string) => {
      content = text;
    },
  };
}

function loadConsumerReact(): typeof import("react") {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require(Bun.resolveSync("react", process.cwd()));
  } catch {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("react");
  }
}

export function createNativeComponentRegistry() {
  const React = loadConsumerReact();
  const cache = new Map<string, ReturnType<typeof createHostComponent>>();
  return {
    get: (name: string) => {
      if (!cache.has(name)) {
        cache.set(name, createHostComponent(React, name.replace(/^(RCT|RK)/, "")));
      }
      return cache.get(name)!;
    },
    getWithFallback_DEPRECATED: (name: string) => {
      if (!cache.has(name)) {
        cache.set(name, createHostComponent(React, name.replace(/^(RCT|RK)/, "")));
      }
      return cache.get(name)!;
    },
    setRuntimeConfigProvider: noop,
    unstable_hasActiveViewConfig: () => false,
  };
}

export function createRequireNativeComponent() {
  const React = loadConsumerReact();
  const cache = new Map<string, ReturnType<typeof createHostComponent>>();
  return function requireNativeComponent(name: string) {
    if (!cache.has(name)) {
      cache.set(name, createHostComponent(React, name.replace(/^(RCT|RK)/, "")));
    }
    return cache.get(name)!;
  };
}

/** Force JS-driven Animated — native driver is unsupported under bun test. */
export function createNativeAnimatedHelper() {
  return {
    API: {},
    addWhitelistedStyleProp: noop,
    addWhitelistedTransformProp: noop,
    assertNativeAnimatedModule: noop,
    generateNewNodeTag: (() => {
      let tag = 1;
      return () => tag++;
    })(),
    generateNewAnimationId: (() => {
      let id = 1;
      return () => id++;
    })(),
    isNativeAnimatedModuleAvailable: false,
    nativeEventEmitter: null,
    shouldUseNativeDriver: () => false,
    transformDataType: (value: unknown) => value,
  };
}

/** @deprecated Prefer createReactNativePublicAPI — kept for coverage of host helpers. */
export function createHostMocks(_window: WindowMetrics) {
  const React = loadConsumerReact();
  return {
    View: createHostComponent(React, "View"),
    Text: createHostComponent(React, "Text"),
    TextInput: createHostComponent(React, "TextInput"),
    Image: createHostComponent(React, "Image"),
    ActivityIndicator: createHostComponent(React, "ActivityIndicator"),
    Modal: createHostComponent(React, "Modal"),
    RefreshControl: createHostComponent(React, "RefreshControl"),
    ScrollView: createHostComponent(React, "ScrollView"),
  };
}
