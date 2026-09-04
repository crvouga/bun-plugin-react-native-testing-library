/**
 * Remaining public APIs: StyleSheet, PanResponder, AppRegistry, LogBox,
 * PermissionsAndroid, PlatformColor, AssetRegistry, codegen*, etc.
 */

import type * as ReactNS from "react";
import { createHostComponent, noop, asyncNoop } from "./host.ts";

export function createStyleSheet() {
  const absoluteFillObject = {
    position: "absolute" as const,
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  };
  return {
    create: <T extends Record<string, unknown>>(styles: T): T => styles,
    flatten: (style: unknown): Record<string, unknown> => {
      if (style == null || style === false) return {};
      if (Array.isArray(style)) {
        return Object.assign(
          {},
          ...style.filter(Boolean).map((s) => createStyleSheet().flatten(s)),
        );
      }
      if (typeof style === "object") return style as Record<string, unknown>;
      return {};
    },
    compose: (a: unknown, b: unknown) => (a == null ? b : b == null ? a : [a, b]),
    hairlineWidth: 1,
    absoluteFillObject,
    absoluteFill: absoluteFillObject,
    setStyleAttributePreprocessor: noop,
  };
}

export function createPanResponder() {
  return {
    create(config: Record<string, unknown>) {
      const handlers: Record<string, unknown> = {};
      const names = [
        "onStartShouldSetResponder",
        "onStartShouldSetResponderCapture",
        "onMoveShouldSetResponder",
        "onMoveShouldSetResponderCapture",
        "onResponderGrant",
        "onResponderReject",
        "onResponderMove",
        "onResponderRelease",
        "onResponderTerminationRequest",
        "onResponderTerminate",
      ];
      for (const n of names) {
        handlers[n] = config[n] ?? (() => false);
      }
      // Map onMoveShouldSetPanResponder -> onMoveShouldSetResponder etc.
      if (config.onStartShouldSetPanResponder) {
        handlers.onStartShouldSetResponder = config.onStartShouldSetPanResponder;
      }
      if (config.onMoveShouldSetPanResponder) {
        handlers.onMoveShouldSetResponder = config.onMoveShouldSetPanResponder;
      }
      if (config.onPanResponderGrant) handlers.onResponderGrant = config.onPanResponderGrant;
      if (config.onPanResponderMove) handlers.onResponderMove = config.onPanResponderMove;
      if (config.onPanResponderRelease) handlers.onResponderRelease = config.onPanResponderRelease;
      if (config.onPanResponderTerminate) {
        handlers.onResponderTerminate = config.onPanResponderTerminate;
      }
      if (config.onPanResponderTerminationRequest) {
        handlers.onResponderTerminationRequest = config.onPanResponderTerminationRequest;
      }
      return { panHandlers: handlers };
    },
  };
}

export function createAppRegistry() {
  const runnables = new Map<string, { component?: unknown; run?: Function }>();
  return {
    registerComponent(appKey: string, componentProvider: () => unknown) {
      runnables.set(appKey, { component: componentProvider });
      return appKey;
    },
    registerRunnable(appKey: string, run: Function) {
      runnables.set(appKey, { run });
      return appKey;
    },
    registerSection: noop,
    getAppKeys: () => [...runnables.keys()],
    getSectionKeys: () => [],
    getSections: () => ({}),
    getRunnable: (appKey: string) => runnables.get(appKey),
    getRegistry: () => ({ runnables: Object.fromEntries(runnables) }),
    setWrapperComponentProvider: noop,
    setRootViewStyleProvider: noop,
    runApplication: noop,
    unmountApplicationComponentAtRootTag: noop,
  };
}

export function createLogBox() {
  return {
    install: noop,
    uninstall: noop,
    ignoreLogs: noop,
    ignoreAllLogs: noop,
    clearAllLogs: noop,
    addLog: noop,
    addException: noop,
    isInstalled: () => true,
  };
}

export function createPermissionsAndroid() {
  const RESULTS = {
    GRANTED: "granted",
    DENIED: "denied",
    NEVER_ASK_AGAIN: "never_ask_again",
  } as const;
  const PERMISSIONS = {
    READ_CALENDAR: "android.permission.READ_CALENDAR",
    WRITE_CALENDAR: "android.permission.WRITE_CALENDAR",
    CAMERA: "android.permission.CAMERA",
    READ_CONTACTS: "android.permission.READ_CONTACTS",
    WRITE_CONTACTS: "android.permission.WRITE_CONTACTS",
    GET_ACCOUNTS: "android.permission.GET_ACCOUNTS",
    ACCESS_FINE_LOCATION: "android.permission.ACCESS_FINE_LOCATION",
    ACCESS_COARSE_LOCATION: "android.permission.ACCESS_COARSE_LOCATION",
    RECORD_AUDIO: "android.permission.RECORD_AUDIO",
    READ_PHONE_STATE: "android.permission.READ_PHONE_STATE",
    CALL_PHONE: "android.permission.CALL_PHONE",
    READ_EXTERNAL_STORAGE: "android.permission.READ_EXTERNAL_STORAGE",
    WRITE_EXTERNAL_STORAGE: "android.permission.WRITE_EXTERNAL_STORAGE",
  };
  return {
    PERMISSIONS,
    RESULTS,
    check: () => Promise.resolve(true),
    checkPermission: () => Promise.resolve(true),
    request: () => Promise.resolve(RESULTS.GRANTED),
    requestPermission: () => Promise.resolve(RESULTS.GRANTED),
    requestMultiple: (perms: string[]) =>
      Promise.resolve(Object.fromEntries(perms.map((p) => [p, RESULTS.GRANTED]))),
  };
}

export function createAssetRegistry() {
  const assets: unknown[] = [];
  return {
    registerAsset: (asset: unknown) => {
      assets.push(asset);
      return assets.length;
    },
    getAssetByID: (id: number) => assets[id - 1] ?? null,
  };
}

export function createCodegenHelpers(React: typeof ReactNS) {
  const cache = new Map<string, ReturnType<typeof createHostComponent>>();
  function codegenNativeComponent(name: string, _options?: unknown) {
    if (!cache.has(name)) {
      cache.set(name, createHostComponent(React, name.replace(/^(RCT|RK)/, "")));
    }
    return cache.get(name)!;
  }
  function codegenNativeCommands<T extends Record<string, unknown>>(spec: T): T {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(spec)) {
      out[key] = noop;
    }
    return out as T;
  }
  return { codegenNativeComponent, codegenNativeCommands };
}

export function createMiscApis(React: typeof ReactNS) {
  const I18nManager = {
    isRTL: false,
    doLeftAndRightSwapInRTL: true,
    allowRTL: noop,
    forceRTL: noop,
    swapLeftAndRightInRTL: noop,
    getConstants: () => ({
      isRTL: false,
      doLeftAndRightSwapInRTL: true,
      localeIdentifier: "en_US",
    }),
  };

  const Alert = {
    alert: noop,
    prompt: noop,
  };

  const Share = {
    share: () => Promise.resolve({ action: "sharedAction", activityType: null }),
    sharedAction: "sharedAction",
    dismissedAction: "dismissedAction",
  };

  const LayoutAnimation = {
    configureNext: noop,
    create: noop,
    checkConfig: noop,
    Types: {
      spring: "spring",
      linear: "linear",
      easeInEaseOut: "easeInEaseOut",
      easeIn: "easeIn",
      easeOut: "easeOut",
      keyboard: "keyboard",
    },
    Properties: { opacity: "opacity", scaleX: "scaleX", scaleY: "scaleY", scaleXY: "scaleXY" },
    Presets: {
      easeInEaseOut: {},
      linear: {},
      spring: {},
    },
  };

  const Easing = {
    linear: (t: number) => t,
    ease: (t: number) => t,
    quad: (t: number) => t * t,
    cubic: (t: number) => t * t * t,
    poly: (n: number) => (t: number) => t ** n,
    sin: (t: number) => 1 - Math.cos((t * Math.PI) / 2),
    circle: (t: number) => 1 - Math.sqrt(1 - t * t),
    exp: (t: number) => 2 ** (10 * (t - 1)),
    elastic: (_bouncing?: number) => (t: number) => t,
    back: (_s?: number) => (t: number) => t,
    bounce: (t: number) => t,
    bezier: (_x1: number, _y1: number, _x2: number, _y2: number) => (t: number) => t,
    in: (f: (t: number) => number) => f,
    out: (f: (t: number) => number) => (t: number) => 1 - f(1 - t),
    inOut: (f: (t: number) => number) => (t: number) =>
      t < 0.5 ? f(t * 2) / 2 : 1 - f((1 - t) * 2) / 2,
    step0: (n: number) => (n > 0 ? 1 : 0),
    step1: (n: number) => (n >= 1 ? 1 : 0),
  };

  const ToastAndroid = {
    SHORT: 0,
    LONG: 1,
    TOP: 0,
    BOTTOM: 1,
    CENTER: 2,
    show: noop,
    showWithGravity: noop,
    showWithGravityAndOffset: noop,
  };

  const ActionSheetIOS = {
    showActionSheetWithOptions: noop,
    showShareActionSheetWithOptions: noop,
    dismissActionSheet: noop,
  };

  const Systrace = {
    isEnabled: () => false,
    beginEvent: noop,
    endEvent: noop,
    beginAsyncEvent: () => 0,
    endAsyncEvent: noop,
    counterEvent: noop,
    attachToRelayProfiler: noop,
    setEnabled: noop,
  };

  const DevSettings = {
    addMenuItem: noop,
    reload: noop,
    onFastRefresh: noop,
  };

  const DevMenu = {
    show: noop,
  };

  const Networking = {
    addListener: () => ({ remove: noop }),
    removeListeners: noop,
    sendRequest: noop,
    abortRequest: noop,
    clearCookies: (cb: (r: boolean) => void) => cb(true),
  };

  const PushNotificationIOS = {
    presentLocalNotification: noop,
    scheduleLocalNotification: noop,
    cancelAllLocalNotifications: noop,
    removeAllDeliveredNotifications: noop,
    getDeliveredNotifications: (cb: (n: unknown[]) => void) => cb([]),
    removeDeliveredNotifications: noop,
    setApplicationIconBadgeNumber: noop,
    getApplicationIconBadgeNumber: (cb: (n: number) => void) => cb(0),
    cancelLocalNotifications: noop,
    getScheduledLocalNotifications: (cb: (n: unknown[]) => void) => cb([]),
    addEventListener: noop,
    removeEventListener: noop,
    requestPermissions: () => Promise.resolve({ alert: true, badge: true, sound: true }),
    abandonPermissions: noop,
    checkPermissions: (cb: (p: unknown) => void) => cb({ alert: true, badge: true, sound: true }),
    getInitialNotification: () => Promise.resolve(null),
    getAuthorizationStatus: (cb: (s: number) => void) => cb(1),
  };

  const UTFSequence = {
    BOM: "\uFEFF",
    BULLET: "\u2022",
    BULLET_SP: "\u2022 ",
    MIDDOT: "\u00B7",
    MIDDOT_KATAKANA: "\u30FB",
    MIDDOT_SP: " \u00B7 ",
    MIDDOT_SP_NARROW: "\u00B7",
    NDASH: "\u2013",
    NDASH_SP: " \u2013 ",
    MDASH: "\u2014",
    MDASH_SP: " \u2014 ",
  };

  const ReactNativeVersion = {
    version: { major: 0, minor: 87, patch: 1, prerelease: null as string | null },
  };

  const RootTagContext = React.createContext(0);

  const VirtualViewMode = {
    Visible: 0,
    Prerender: 1,
    Hidden: 2,
  };

  const DeviceInfo = {
    getConstants: () => ({
      Dimensions: {
        window: { width: 390, height: 844, scale: 3, fontScale: 1 },
        screen: { width: 390, height: 844, scale: 3, fontScale: 1 },
      },
      isIPhoneX_deprecated: false,
    }),
  };

  function PlatformColor(..._names: string[]) {
    return { semantic: _names };
  }

  function DynamicColorIOS(tuple: { light: unknown; dark: unknown }) {
    return { dynamic: tuple };
  }

  function processColor(c: unknown) {
    return c;
  }

  function findNodeHandle(_ref: unknown) {
    return null;
  }

  function usePressability(_config?: unknown) {
    return {};
  }

  const registerCallableModule = noop;

  // Unstable / experimental stubs
  const unstable_NativeText = createHostComponent(React, "Text");
  const unstable_NativeView = createHostComponent(React, "View");
  const unstable_TextAncestorContext = React.createContext(false);
  const experimental_LayoutConformance = ({ children }: { children?: ReactNS.ReactNode }) =>
    children ?? null;

  const unstable_VirtualArray = null;
  const unstable_VirtualColumn = null;
  const unstable_VirtualColumnGenerator = null;
  const unstable_VirtualRow = null;
  const unstable_VirtualView = createHostComponent(React, "VirtualView");
  const unstable_createVirtualCollectionView = noop;
  const unstable_getScrollParent = () => null;

  return {
    I18nManager,
    Alert,
    Share,
    LayoutAnimation,
    Easing,
    ToastAndroid,
    ActionSheetIOS,
    Systrace,
    DevSettings,
    DevMenu,
    Networking,
    PushNotificationIOS,
    UTFSequence,
    ReactNativeVersion,
    RootTagContext,
    VirtualViewMode,
    DeviceInfo,
    PlatformColor,
    DynamicColorIOS,
    processColor,
    findNodeHandle,
    usePressability,
    registerCallableModule,
    unstable_NativeText,
    unstable_NativeView,
    unstable_TextAncestorContext,
    experimental_LayoutConformance,
    unstable_VirtualArray,
    unstable_VirtualColumn,
    unstable_VirtualColumnGenerator,
    unstable_VirtualRow,
    unstable_VirtualView,
    unstable_createVirtualCollectionView,
    unstable_getScrollParent,
    asyncNoop,
  };
}
