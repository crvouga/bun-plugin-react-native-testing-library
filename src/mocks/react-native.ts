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
import { createNativeModules } from "./NativeModules.ts";
import { createPlatform } from "./Platform.ts";
import {
  createAnimated,
  createUseAnimatedColor,
  createUseAnimatedValue,
  createUseAnimatedValueXY,
} from "./animated.ts";
import {
  createAssetRegistry,
  createAppRegistry,
  createCodegenHelpers,
  createLogBox,
  createMiscApis,
  createPanResponder,
  createPermissionsAndroid,
  createStyleSheet,
} from "./apis.ts";
import { createComponents } from "./components.ts";
import {
  EventEmitter,
  NativeEventEmitter,
  createAppStateWithEmitter,
  createBackHandler,
  createDeviceEventEmitter,
  createKeyboard,
  createLinkingWithEmitter,
} from "./events.ts";
import { noop } from "./host.ts";
import { DEFAULT_INITIAL_NUM_TO_RENDER, createLists } from "./lists.ts";
import {
  createAccessibilityInfo,
  createAppearance,
  createClipboard,
  createInteractionManager,
  createNativeComponentRegistry,
  createPixelRatio,
  createRequireNativeComponent,
  createSettings,
  createUIManager,
  createTurboModuleRegistry,
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

/**
 * Build the module shape returned by `mock.module("react-native", …)`.
 * Covers every getter exported by react-native/index.js (96 names).
 */
export function createReactNativePublicAPI(config: ResolvedConfig) {
  const React = loadConsumerReact();
  const components = createComponents(React);
  const lists = createLists(React, components.View);
  const Animated = createAnimated(React, {
    View: components.View,
    Text: components.Text,
    Image: components.Image,
    ScrollView: components.ScrollView,
    FlatList: lists.FlatList,
  });

  const Platform = createPlatform(config.platform);
  const Dimensions = createDimensions(config.window);
  const useWindowDimensions = createUseWindowDimensions(React, config.window);
  const PixelRatio = createPixelRatio();
  const Appearance = createAppearance();
  const AccessibilityInfo = createAccessibilityInfo();
  const Settings = createSettings();
  const InteractionManager = createInteractionManager();
  const Vibration = createVibration();
  const Clipboard = createClipboard();
  const StyleSheet = createStyleSheet();
  const NativeModules = createNativeModules(config.window);
  const TurboModuleRegistry = createTurboModuleRegistry(NativeModules);
  const UIManager = createUIManager();
  const NativeComponentRegistry = createNativeComponentRegistry();
  const requireNativeComponent = createRequireNativeComponent();
  const { codegenNativeComponent, codegenNativeCommands } = createCodegenHelpers(React);

  const deviceEmitter = createDeviceEventEmitter();
  const Keyboard = createKeyboard(new EventEmitter());
  const BackHandler = createBackHandler(new EventEmitter());
  const AppState = createAppStateWithEmitter(new EventEmitter());
  const Linking = createLinkingWithEmitter(new EventEmitter());

  const misc = createMiscApis(React);
  const AssetRegistry = createAssetRegistry();
  const AppRegistry = createAppRegistry();
  const LogBox = createLogBox();
  const PanResponder = createPanResponder();
  const PermissionsAndroid = createPermissionsAndroid();

  const useAnimatedValue = createUseAnimatedValue(React);
  const useAnimatedValueXY = createUseAnimatedValueXY(React);
  const useAnimatedColor = createUseAnimatedColor(React);

  return {
    View: components.View,
    Text: components.Text,
    TextInput: components.TextInput,
    Image: components.Image,
    ImageBackground: components.ImageBackground,
    ScrollView: components.ScrollView,
    FlatList: lists.FlatList,
    SectionList: lists.SectionList,
    VirtualizedList: lists.VirtualizedList,
    VirtualizedSectionList: lists.VirtualizedSectionList,
    Pressable: components.Pressable,
    TouchableOpacity: components.TouchableOpacity,
    TouchableHighlight: components.TouchableHighlight,
    TouchableWithoutFeedback: components.TouchableWithoutFeedback,
    TouchableNativeFeedback: components.TouchableNativeFeedback,
    Button: components.Button,
    ActivityIndicator: components.ActivityIndicator,
    Modal: components.Modal,
    RefreshControl: components.RefreshControl,
    SafeAreaView: components.SafeAreaView,
    KeyboardAvoidingView: components.KeyboardAvoidingView,
    InputAccessoryView: components.InputAccessoryView,
    DrawerLayoutAndroid: components.DrawerLayoutAndroid,
    ProgressBarAndroid: components.ProgressBarAndroid,
    StatusBar: components.StatusBar,
    Switch: components.Switch,

    // Not a public index.js getter, but required by react-native-svg (Touchable.Mixin)
    Touchable: {
      Mixin: {
        touchableGetInitialState: () => ({
          touchable: { touchState: undefined, responderID: null },
        }),
        touchableHandleResponderGrant: noop,
        touchableHandleResponderMove: noop,
        touchableHandleResponderRelease: noop,
        touchableHandleResponderTerminate: noop,
        touchableHandleStartShouldSetResponder: () => true,
        touchableGetHighlightDelayMS: () => 0,
        touchableGetPressRectOffset: () => ({ left: 20, top: 20, right: 20, bottom: 20 }),
      },
      TOUCH_TARGET_DEBUG: false,
    },

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
    BackHandler,
    Keyboard,

    Animated,
    Easing: misc.Easing,
    useAnimatedValue,
    useAnimatedValueXY,
    useAnimatedColor,

    unstable_DEFAULT_INITIAL_NUM_TO_RENDER: DEFAULT_INITIAL_NUM_TO_RENDER,

    EventEmitter,
    NativeEventEmitter,
    DeviceEventEmitter: deviceEmitter,
    NativeAppEventEmitter: deviceEmitter,

    NativeModules,
    TurboModuleRegistry,
    UIManager,
    NativeComponentRegistry,
    requireNativeComponent,
    codegenNativeComponent,
    codegenNativeCommands,
    findNodeHandle: misc.findNodeHandle,
    processColor: misc.processColor,

    AppRegistry,
    LogBox,
    AssetRegistry,
    PanResponder,
    PermissionsAndroid,

    I18nManager: misc.I18nManager,
    Alert: misc.Alert,
    Share: misc.Share,
    LayoutAnimation: misc.LayoutAnimation,
    ToastAndroid: misc.ToastAndroid,
    ActionSheetIOS: misc.ActionSheetIOS,
    Systrace: misc.Systrace,
    DevSettings: misc.DevSettings,
    DevMenu: misc.DevMenu,
    Networking: misc.Networking,
    PushNotificationIOS: misc.PushNotificationIOS,
    UTFSequence: misc.UTFSequence,
    ReactNativeVersion: misc.ReactNativeVersion,
    RootTagContext: misc.RootTagContext,
    VirtualViewMode: misc.VirtualViewMode,
    DeviceInfo: misc.DeviceInfo,
    PlatformColor: misc.PlatformColor,
    DynamicColorIOS: misc.DynamicColorIOS,
    usePressability: misc.usePressability,
    registerCallableModule: misc.registerCallableModule,

    unstable_NativeText: misc.unstable_NativeText,
    unstable_NativeView: misc.unstable_NativeView,
    unstable_TextAncestorContext: misc.unstable_TextAncestorContext,
    experimental_LayoutConformance: misc.experimental_LayoutConformance,
    unstable_VirtualArray: misc.unstable_VirtualArray,
    unstable_VirtualColumn: misc.unstable_VirtualColumn,
    unstable_VirtualColumnGenerator: misc.unstable_VirtualColumnGenerator,
    unstable_VirtualRow: misc.unstable_VirtualRow,
    unstable_VirtualView: misc.unstable_VirtualView,
    unstable_createVirtualCollectionView: misc.unstable_createVirtualCollectionView,
    unstable_getScrollParent: misc.unstable_getScrollParent,
  };
}

export type ReactNativePublicAPI = ReturnType<typeof createReactNativePublicAPI>;
