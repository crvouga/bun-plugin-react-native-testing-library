/**
 * Register mocks via Bun's `mock.module()`.
 *
 * Primary strategy (Bun 1.4.0): replace the public `react-native` entry.
 * Direct onLoad of node_modules yields empty Module {} (#10083), and bare
 * specifiers skip runtime onResolve — so Flow transform never reaches index.js.
 *
 * Important: `mock.module("react-native")` resolves the specifier relative to
 * the module that *calls* it. When preload lives inside this package (or is
 * loaded via an absolute path into this package), that resolution hits *this*
 * package's nested `node_modules/react-native`, not the consumer's. Always
 * also mock the absolute path resolved from `process.cwd()`.
 */

import { mock } from "bun:test";
import type { ResolvedConfig } from "../config.ts";
import { EventEmitter, NativeEventEmitter } from "./events.ts";
import { createNativeAnimatedHelper } from "./surfaces.ts";
import { createReactNativePublicAPI, type ReactNativePublicAPI } from "./react-native.ts";

function mockSpecifier(specifier: string, factory: () => unknown): void {
  try {
    mock.module(specifier, factory);
  } catch {
    // ignore
  }
  try {
    const abs = Bun.resolveSync(specifier, process.cwd());
    mock.module(abs, factory);
  } catch {
    // ignore
  }
}

function mockReactNative(factory: () => unknown): void {
  mock.module("react-native", factory);
  try {
    const abs = Bun.resolveSync("react-native", process.cwd());
    mock.module(abs, factory);
  } catch {
    // consumer may not have react-native installed yet
  }
}

/**
 * Deep `react-native/Libraries/...` paths that popular libraries import
 * directly. Bare specifiers skip runtime onResolve, so each must be covered
 * by `mock.module` or Flow-typed sources crash Bun's transpiler.
 *
 * Allowlisted without a factory entry: `react-native/package.json` (JSON).
 */
export const DEEP_PATHS: Record<string, (api: ReactNativePublicAPI) => unknown> = {
  "react-native/setup-env": () => ({}),

  "react-native/Libraries/Components/View/View": (api) => ({
    default: api.View,
    __esModule: true,
  }),
  "react-native/Libraries/Text/Text": (api) => ({
    default: api.Text,
    __esModule: true,
  }),
  "react-native/Libraries/Components/TextInput/TextInput": (api) => ({
    default: api.TextInput,
    __esModule: true,
  }),
  "react-native/Libraries/Image/Image": (api) => ({
    default: api.Image,
    __esModule: true,
  }),
  "react-native/Libraries/Components/ScrollView/ScrollView": (api) => ({
    default: api.ScrollView,
    __esModule: true,
  }),
  "react-native/Libraries/Lists/FlatList": (api) => ({
    default: api.FlatList,
    __esModule: true,
  }),
  "react-native/Libraries/Lists/SectionList": (api) => ({
    default: api.SectionList,
    __esModule: true,
  }),
  "react-native/Libraries/Lists/VirtualizedList": (api) => ({
    default: api.VirtualizedList,
    __esModule: true,
  }),

  "react-native/Libraries/Utilities/Platform": (api) => ({
    default: api.Platform,
    ...api.Platform,
    __esModule: true,
  }),
  "react-native/Libraries/Utilities/Dimensions": (api) => ({
    default: api.Dimensions,
    ...api.Dimensions,
    __esModule: true,
  }),
  "react-native/Libraries/StyleSheet/StyleSheet": (api) => ({
    default: api.StyleSheet,
    ...api.StyleSheet,
    __esModule: true,
  }),
  "react-native/Libraries/BatchedBridge/NativeModules": (api) => ({
    default: api.NativeModules,
    __esModule: true,
  }),
  "react-native/Libraries/TurboModule/TurboModuleRegistry": (api) => ({
    default: api.TurboModuleRegistry,
    ...api.TurboModuleRegistry,
    get: api.TurboModuleRegistry.get.bind(api.TurboModuleRegistry),
    getEnforcing: api.TurboModuleRegistry.getEnforcing.bind(api.TurboModuleRegistry),
    __esModule: true,
  }),
  "react-native/Libraries/ReactNative/UIManager": (api) => ({
    default: api.UIManager,
    ...api.UIManager,
    __esModule: true,
  }),
  "react-native/Libraries/Animated/NativeAnimatedHelper": () => ({
    default: createNativeAnimatedHelper(),
    ...createNativeAnimatedHelper(),
    __esModule: true,
  }),

  "react-native/Libraries/Utilities/codegenNativeComponent": (api) => ({
    default: api.codegenNativeComponent,
    __esModule: true,
  }),
  "react-native/Libraries/Utilities/codegenNativeCommands": (api) => ({
    default: api.codegenNativeCommands,
    __esModule: true,
  }),
  "react-native/Libraries/NativeComponent/NativeComponentRegistry": (api) => ({
    default: api.NativeComponentRegistry,
    ...api.NativeComponentRegistry,
    __esModule: true,
  }),
  "react-native/Libraries/NativeComponent/ViewConfigIgnore": () => ({
    ConditionallyIgnoredEventHandlers: (handlers: unknown) => handlers,
    DynamicallyInjectedByVerifyType: Symbol("DynamicallyInjectedByVerifyType"),
    __esModule: true,
  }),

  "react-native/Libraries/Image/AssetRegistry": (api) => ({
    default: api.AssetRegistry,
    ...api.AssetRegistry,
    registerAsset: api.AssetRegistry.registerAsset,
    getAssetByID: api.AssetRegistry.getAssetByID,
    __esModule: true,
  }),
  "react-native/Libraries/Image/AssetSourceResolver": () => ({
    default: class AssetSourceResolver {
      defaultAsset() {
        return { uri: "" };
      }
      isLoadedFromServer() {
        return false;
      }
      isLoadedFromFileSystem() {
        return false;
      }
    },
    __esModule: true,
  }),

  "react-native/Libraries/EventEmitter/NativeEventEmitter": () => ({
    default: NativeEventEmitter,
    __esModule: true,
  }),
  "react-native/Libraries/EventEmitter/RCTDeviceEventEmitter": (api) => ({
    default: api.DeviceEventEmitter,
    __esModule: true,
  }),
  "react-native/Libraries/vendor/emitter/EventEmitter": () => ({
    default: EventEmitter,
    EventEmitter,
    __esModule: true,
  }),

  "react-native/Libraries/Renderer/shims/ReactFabric": (api) => ({
    default: {
      findNodeHandle: api.findNodeHandle,
      dispatchCommand: () => {},
      sendAccessibilityEvent: () => {},
      getNodeFromInternalInstanceHandle: () => null,
    },
    findNodeHandle: api.findNodeHandle,
    dispatchCommand: () => {},
    sendAccessibilityEvent: () => {},
    __esModule: true,
  }),
  "react-native/Libraries/Renderer/shims/ReactNative": (api) => ({
    default: {
      findNodeHandle: api.findNodeHandle,
      dispatchCommand: () => {},
    },
    findNodeHandle: api.findNodeHandle,
    __esModule: true,
  }),
  "react-native/Libraries/Renderer/shims/ReactNativeViewConfigRegistry": () => {
    const configs = new Map<string, unknown>();
    return {
      customBubblingEventTypes: {},
      customDirectEventTypes: {},
      register: (name: string, callback: () => unknown) => {
        configs.set(name, callback());
        return name;
      },
      get: (name: string) => configs.get(name),
      __esModule: true,
    };
  },
  "react-native/Libraries/ReactNative/ReactFabricPublicInstance/ReactFabricPublicInstance": () => ({
    createPublicRootInstance: () => ({}),
    createPublicInstance: () => ({}),
    createPublicTextInstance: () => ({}),
    getNativeTagFromPublicInstance: () => 0,
    getNodeFromPublicInstance: () => null,
    getInternalInstanceHandleFromPublicInstance: () => null,
    __esModule: true,
  }),
  "react-native/Libraries/ReactNative/AppContainer": (api) => ({
    default: api.View,
    __esModule: true,
  }),
  "react-native/Libraries/ReactNative/RendererProxy": (api) => ({
    default: {
      findNodeHandle: api.findNodeHandle,
      dispatchCommand: () => {},
      sendAccessibilityEvent: () => {},
    },
    findNodeHandle: api.findNodeHandle,
    dispatchCommand: () => {},
    __esModule: true,
  }),
  "react-native/Libraries/ReactNative/BridgelessUIManager": (api) => ({
    default: api.UIManager,
    ...api.UIManager,
    __esModule: true,
  }),

  "react-native/Libraries/Pressability/PressabilityDebug": (api) => ({
    PressabilityDebugView: api.View,
    isEnabled: () => false,
    setEnabled: () => {},
    __esModule: true,
  }),
  "react-native/Libraries/Pressability/Pressability": () => ({
    default: class Pressability {
      configure() {}
      reset() {}
      getEventHandlers() {
        return {};
      }
    },
    __esModule: true,
  }),

  "react-native/Libraries/Components/View/ReactNativeStyleAttributes": () => ({
    default: new Proxy(
      {},
      {
        get: (_t, prop) => (typeof prop === "string" ? true : undefined),
      },
    ),
    __esModule: true,
  }),
  "react-native/Libraries/Components/View/ViewPropTypes": () => ({
    default: {},
    __esModule: true,
  }),

  "react-native/Libraries/BatchedBridge/BatchedBridge": () => ({
    default: {
      registerCallableModule: () => {},
      registerLazyCallableModule: () => {},
      callFunctionReturnFlushedQueue: () => null,
      invokeCallbackAndReturnFlushedQueue: () => null,
      flushedQueue: () => null,
      getCallFunctionReturnFlushedQueue: () => null,
    },
    registerCallableModule: () => {},
    __esModule: true,
  }),
  "react-native/Libraries/Core/setUpXHR": () => ({
    default: () => {},
    __esModule: true,
  }),
  "react-native/Libraries/Utilities/PolyfillFunctions": () => ({
    polyfillGlobal: () => {},
    polyfillObjectProperty: () => {},
    __esModule: true,
  }),
  "react-native/Libraries/Utilities/defineLazyObjectProperty": () => ({
    default: (obj: Record<string, unknown>, name: string, desc: { get: () => unknown }) => {
      Object.defineProperty(obj, name, { configurable: true, enumerable: true, get: desc.get });
    },
    __esModule: true,
  }),
  "react-native/Libraries/Utilities/stringifySafe": () => ({
    default: (v: unknown) => {
      try {
        return JSON.stringify(v);
      } catch {
        return String(v);
      }
    },
    createStringifySafeWithLimits: () => (v: unknown) => String(v),
    __esModule: true,
  }),
  "react-native/Libraries/Utilities/differ/deepDiffer": () => ({
    default: (a: unknown, b: unknown) => a !== b,
    __esModule: true,
  }),
  "react-native/Libraries/ReactNative/requireNativeComponent": (api) => ({
    default: api.requireNativeComponent,
    __esModule: true,
  }),

  // Flow type modules — popular libraries import these; provide empty shapes.
  "react-native/Libraries/Types/CodegenTypes": () => ({
    WithDefault: undefined,
    Float: undefined,
    Double: undefined,
    Int32: undefined,
    UnsafeObject: undefined,
    BubblingEventHandler: undefined,
    DirectEventHandler: undefined,
    __esModule: true,
  }),
  "react-native/Libraries/TurboModule/RCTExport": () => ({
    TurboModule: undefined,
    RootTag: undefined,
    __esModule: true,
  }),
  "react-native/Libraries/Types/CoreEventTypes": () => ({
    __esModule: true,
  }),
  "react-native/Libraries/Image/ImageSource": () => ({
    __esModule: true,
  }),
  "react-native/Libraries/Renderer/shims/ReactNativeTypes": () => ({
    __esModule: true,
  }),
  "react-native/Libraries/StyleSheet/processColor": () => ({
    default: (c: unknown) => c,
    processColor: (c: unknown) => c,
    __esModule: true,
  }),
  "react-native/Libraries/Image/resolveAssetSource": () => {
    const resolveAssetSource = (s: unknown) => s;
    return { default: resolveAssetSource, resolveAssetSource, __esModule: true };
  },
  "react-native/Libraries/Utilities/binaryToBase64": () => {
    const toB64 = (data: ArrayBuffer | Uint8Array | string) => {
      if (typeof data === "string") return Buffer.from(data).toString("base64");
      const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
      return Buffer.from(bytes).toString("base64");
    };
    return { default: toB64, binaryToBase64: toB64, __esModule: true };
  },
  "react-native/Libraries/Components/TextInput/TextInputState": () => ({
    currentlyFocusedInput: () => null,
    currentlyFocusedField: () => null,
    focusTextInput: () => {},
    blurTextInput: () => {},
    registerInput: () => {},
    unregisterInput: () => {},
    isTextInput: () => false,
    __esModule: true,
  }),
  "react-native/Libraries/Core/Devtools/getDevServer": () => {
    const getDevServer = () => ({ url: "http://localhost:8081/", fullBundleUrl: null, bundleLoadedFromServer: false });
    return { default: getDevServer, getDevServer, __esModule: true };
  },
};

/** Specifiers that are valid to import without a DEEP_PATHS factory. */
export const DEEP_PATH_ALLOWLIST = new Set(["react-native/package.json"]);

export function registerMocks(config: ResolvedConfig): ReactNativePublicAPI {
  const publicAPI = createReactNativePublicAPI(config);

  mockReactNative(() => publicAPI);

  for (const [specifier, factory] of Object.entries(DEEP_PATHS)) {
    mockSpecifier(specifier, () => factory(publicAPI));
  }

  if (config.debug) {
    console.log(`[rn-bun] Registered ${Object.keys(DEEP_PATHS).length} deep react-native path mocks`);
  }

  return publicAPI;
}
