/**
 * Full public `react-native` module mock.
 *
 * Bun 1.4.0 cannot reliably `onLoad`-transform `node_modules/react-native/**`
 * (oven-sh/bun#10083 → empty `Module {}`). Bare `react-native` also skips
 * runtime `onResolve`. The robust fix is to `mock.module("react-native", …)`
 * with a behaviour-minimal public API so user components and RNTL never touch
 * Flow-typed RN sources.
 *
 * React is resolved from `process.cwd()` so host components share the
 * consumer's React copy (avoids "Invalid hook call" with file: installs).
 */

import type { ResolvedConfig } from "../config.ts";
import { createDimensions, createUseWindowDimensions } from "./Dimensions.ts";
import { createHostComponent, noop } from "./host.ts";
import { createPlatform } from "./Platform.ts";
import {
  createAccessibilityInfo,
  createAppearance,
  createAppState,
  createClipboard,
  createInteractionManager,
  createLinking,
  createPixelRatio,
  createSettings,
  createVibration,
} from "./surfaces.ts";

function loadConsumerReact(): typeof import("react") {
  try {
    const abs = Bun.resolveSync("react", process.cwd());
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require(abs);
  } catch {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("react");
  }
}

function StyleSheetImpl() {
  return {
    create: <T extends Record<string, unknown>>(styles: T): T => styles,
    flatten: (style: unknown): Record<string, unknown> => {
      if (style == null) return {};
      if (Array.isArray(style)) {
        return Object.assign({}, ...style.filter(Boolean).map(StyleSheetImpl().flatten));
      }
      if (typeof style === "object") return style as Record<string, unknown>;
      return {};
    },
    compose: (a: unknown, b: unknown) => [a, b],
    hairlineWidth: 1,
    absoluteFillObject: {
      position: "absolute" as const,
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
    },
    absoluteFill: {
      position: "absolute" as const,
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
    },
  };
}

/**
 * Build the module shape returned by `mock.module("react-native", …)`.
 */
export function createReactNativePublicAPI(config: ResolvedConfig) {
  const React = loadConsumerReact();

  const View = createHostComponent(React, "View");
  const Text = createHostComponent(React, "Text");
  const TextInput = createHostComponent(React, "TextInput", {
    instanceMethods: { isFocused: () => false, clear: noop, focus: noop, blur: noop },
  });
  const Image = createHostComponent(React, "Image", {
    statics: {
      getSize: (_u: string, ok: (w: number, h: number) => void) => ok(320, 240),
      prefetch: () => Promise.resolve(true),
      resolveAssetSource: (s: unknown) => s,
    },
  });

  const ScrollView = class ScrollView extends React.Component<
    Record<string, unknown> & { children?: React.ReactNode; refreshControl?: React.ReactNode }
  > {
    static displayName = "ScrollView";
    scrollTo = noop;
    scrollToEnd = noop;
    render() {
      const { children, refreshControl, ...rest } = this.props;
      return React.createElement(
        "RCTScrollView",
        rest,
        refreshControl,
        React.createElement(View, null, children),
      );
    }
  };

  const Pressable = class Pressable extends React.Component<
    Record<string, unknown> & {
      children?: React.ReactNode | ((state: { pressed: boolean }) => React.ReactNode);
      onPress?: (e: unknown) => void;
      onLongPress?: (e: unknown) => void;
      disabled?: boolean;
      testID?: string;
      accessibilityRole?: string;
      accessibilityLabel?: string;
    }
  > {
    static displayName = "Pressable";
    render() {
      const { children, onPress, onLongPress, disabled, ...rest } = this.props;
      const child = typeof children === "function" ? children({ pressed: false }) : children;
      return React.createElement(
        "Pressable",
        {
          ...rest,
          onPress: disabled ? undefined : onPress,
          onLongPress: disabled ? undefined : onLongPress,
          disabled,
          accessibilityRole: rest.accessibilityRole ?? "button",
        },
        child,
      );
    }
  };

  type FlatListProps = {
    data?: ReadonlyArray<unknown>;
    renderItem?: (info: { item: unknown; index: number }) => React.ReactNode;
    keyExtractor?: (item: unknown, index: number) => string;
    ListHeaderComponent?: React.ReactNode | React.ComponentType;
    ListFooterComponent?: React.ReactNode | React.ComponentType;
    ListEmptyComponent?: React.ReactNode | React.ComponentType;
    ItemSeparatorComponent?: React.ComponentType;
    testID?: string;
    [key: string]: unknown;
  };

  const FlatList = class FlatList extends React.Component<FlatListProps> {
    static displayName = "FlatList";
    render() {
      const {
        data = [],
        renderItem,
        keyExtractor,
        ListHeaderComponent,
        ListFooterComponent,
        ListEmptyComponent,
        ItemSeparatorComponent,
        ...rest
      } = this.props;

      const renderMaybe = (c: React.ReactNode | React.ComponentType | undefined) => {
        if (c == null) return null;
        if (typeof c === "function") return React.createElement(c as React.ComponentType);
        return c as React.ReactNode;
      };

      const items =
        data.length === 0
          ? [renderMaybe(ListEmptyComponent)]
          : data.flatMap((item, index) => {
              const row = renderItem?.({ item, index }) ?? null;
              const key = keyExtractor ? keyExtractor(item, index) : String(index);
              const nodes: React.ReactNode[] = [
                React.createElement(React.Fragment, { key }, row),
              ];
              if (ItemSeparatorComponent && index < data.length - 1) {
                nodes.push(
                  React.createElement(ItemSeparatorComponent, { key: `sep-${key}` }),
                );
              }
              return nodes;
            });

      return React.createElement(
        "RCTScrollView",
        rest,
        renderMaybe(ListHeaderComponent),
        React.createElement("View", null, ...items),
        renderMaybe(ListFooterComponent),
      );
    }
  };

  const SectionList = FlatList;
  const ActivityIndicator = createHostComponent(React, "ActivityIndicator");
  const Modal = createHostComponent(React, "Modal");
  const RefreshControl = createHostComponent(React, "RefreshControl");
  const SafeAreaView = createHostComponent(React, "SafeAreaView");
  const KeyboardAvoidingView = createHostComponent(React, "KeyboardAvoidingView");
  const StatusBar = createHostComponent(React, "StatusBar", {
    statics: { setBarStyle: noop, setHidden: noop, setNetworkActivityIndicatorVisible: noop },
  });
  const Switch = createHostComponent(React, "RCTSwitch");
  const TouchableOpacity = createHostComponent(React, "TouchableOpacity");
  const TouchableHighlight = createHostComponent(React, "TouchableHighlight");
  const TouchableWithoutFeedback = createHostComponent(React, "TouchableWithoutFeedback");
  const Button = createHostComponent(React, "Button");

  const Platform = createPlatform(config.platform);
  const Dimensions = createDimensions(config.window);
  const useWindowDimensions = createUseWindowDimensions(React, config.window);
  const PixelRatio = createPixelRatio();
  const Appearance = createAppearance();
  const AccessibilityInfo = createAccessibilityInfo();
  const AppState = createAppState();
  const Linking = createLinking();
  const Vibration = createVibration();
  const Clipboard = createClipboard();
  const Settings = createSettings();
  const InteractionManager = createInteractionManager();
  const StyleSheet = StyleSheetImpl();

  const Animated = {
    View,
    Text,
    Image,
    ScrollView,
    FlatList,
    createAnimatedComponent: <T>(c: T) => c,
    Value: class AnimatedValue {
      _value: number;
      constructor(v = 0) {
        this._value = v;
      }
      setValue(v: number) {
        this._value = v;
      }
      addListener() {
        return "0";
      }
      removeListener = noop;
      removeAllListeners = noop;
      stopAnimation = (cb?: (v: number) => void) => cb?.(this._value);
      interpolate = () => this;
      __getValue = () => this._value;
    },
    timing: (_v: unknown, _cfg: unknown) => ({
      start: (cb?: (r: { finished: boolean }) => void) => cb?.({ finished: true }),
      stop: noop,
    }),
    spring: (_v: unknown, _cfg: unknown) => ({
      start: (cb?: (r: { finished: boolean }) => void) => cb?.({ finished: true }),
      stop: noop,
    }),
    decay: (_v: unknown, _cfg: unknown) => ({
      start: (cb?: (r: { finished: boolean }) => void) => cb?.({ finished: true }),
      stop: noop,
    }),
    sequence: (anims: Array<{ start: Function }>) => ({
      start: (cb?: Function) => {
        for (const a of anims) a.start?.();
        cb?.({ finished: true });
      },
      stop: noop,
    }),
    parallel: (anims: Array<{ start: Function }>) => ({
      start: (cb?: Function) => {
        for (const a of anims) a.start?.();
        cb?.({ finished: true });
      },
      stop: noop,
    }),
    delay: () => ({ start: (cb?: Function) => cb?.({ finished: true }), stop: noop }),
    event: () => noop,
    add: (a: unknown, b: unknown) => ({ a, b }),
    multiply: (a: unknown, b: unknown) => ({ a, b }),
  };

  const I18nManager = {
    isRTL: false,
    allowRTL: noop,
    forceRTL: noop,
    swapLeftAndRightInRTL: noop,
    getConstants: () => ({ isRTL: false, doLeftAndRightSwapInRTL: true }),
  };

  return {
    View,
    Text,
    TextInput,
    Image,
    ScrollView,
    FlatList,
    SectionList,
    Pressable,
    TouchableOpacity,
    TouchableHighlight,
    TouchableWithoutFeedback,
    Button,
    ActivityIndicator,
    Modal,
    RefreshControl,
    SafeAreaView,
    KeyboardAvoidingView,
    StatusBar,
    Switch,
    StyleSheet,
    Platform,
    Dimensions,
    useWindowDimensions,
    PixelRatio,
    Appearance,
    useColorScheme: () => Appearance.getColorScheme(),
    AccessibilityInfo,
    AppState,
    Linking,
    Vibration,
    Clipboard,
    Settings,
    InteractionManager,
    Animated,
    Easing: {
      linear: (t: number) => t,
      ease: (t: number) => t,
      quad: (t: number) => t * t,
      cubic: (t: number) => t * t * t,
      in: (f: (t: number) => number) => f,
      out: (f: (t: number) => number) => f,
      inOut: (f: (t: number) => number) => f,
    },
    I18nManager,
    Alert: { alert: noop },
    Share: { share: () => Promise.resolve({ action: "sharedAction" }) },
    Keyboard: {
      dismiss: noop,
      addListener: () => ({ remove: noop }),
      removeListener: noop,
    },
    LayoutAnimation: {
      configureNext: noop,
      create: noop,
      Types: {},
      Properties: {},
      Presets: {},
    },
    NativeModules: {},
    TurboModuleRegistry: {
      get: () => null,
      getEnforcing: () => new Proxy({}, { get: () => noop }),
    },
    UIManager: {
      getViewManagerConfig: () => ({ Commands: {} }),
      hasViewManagerConfig: () => false,
      measure: noop,
      measureInWindow: noop,
      dispatchViewManagerCommand: noop,
    },
    findNodeHandle: () => null,
    requireNativeComponent: (name: string) =>
      createHostComponent(React, name.replace(/^(RCT|RK)/, "")),
    processColor: (c: unknown) => c,
    Display: { get: () => config.window },
  };
}

export type ReactNativePublicAPI = ReturnType<typeof createReactNativePublicAPI>;
