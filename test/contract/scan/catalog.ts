/**
 * Packages the real-world sandboxes must keep importable under bun:test.
 * Used by fail-closed scanners (deep-path inventory, import surface, platform files).
 */

export type CatalogEntry = {
  /** Package name as installed in the sandbox. */
  name: string;
  /** Expected export names that must be present and non-undefined after require. */
  exports?: readonly string[];
  /** Registry shim name that must activate when the package needs a mock. */
  shim?: string;
  /** If true, package is pure JS and must load without a shim. */
  pureJs?: boolean;
  /** Side-effect polyfill — empty module exports are OK. */
  sideEffect?: boolean;
};

/** Catalog for test/real-world. */
export const REAL_WORLD_CATALOG: readonly CatalogEntry[] = [
  { name: "react-native-reanimated", exports: ["default", "useSharedValue", "withTiming"], shim: "reanimated" },
  { name: "react-native-worklets", exports: ["runOnJS", "runOnUI"], shim: "worklets" },
  { name: "react-native-gesture-handler", exports: ["GestureHandlerRootView"], shim: "gesture-handler" },
  { name: "react-native-safe-area-context", exports: ["SafeAreaProvider", "useSafeAreaInsets"], shim: "safe-area" },
  { name: "react-native-screens", exports: ["enableScreens", "Screen"], shim: "screens" },
  {
    name: "@react-native-async-storage/async-storage",
    exports: ["default", "setItem", "getItem"],
    shim: "async-storage",
  },
  { name: "@shopify/react-native-skia", exports: ["Canvas", "Circle"], shim: "skia" },
  { name: "react-native-mmkv", exports: ["createMMKV"], shim: "mmkv" },
  { name: "react-native-device-info", exports: ["default", "getBrand"], shim: "device-info" },
  { name: "react-native-linear-gradient", exports: ["default"], shim: "linear-gradient" },
  { name: "react-native-webview", exports: ["default"], shim: "webview" },
  { name: "react-native-svg", exports: ["default"], shim: "svg" },
  { name: "react-native-paper", exports: ["Provider", "Button"], pureJs: true },
  { name: "zustand", exports: ["create"], pureJs: true },
  { name: "@tanstack/react-query", exports: ["QueryClient", "useQuery"], pureJs: true },
  { name: "@reduxjs/toolkit", exports: ["configureStore", "createSlice"], pureJs: true },
  { name: "react-hook-form", exports: ["useForm"], pureJs: true },
  { name: "@react-navigation/native", exports: ["NavigationContainer"], pureJs: true },
  { name: "@react-navigation/native-stack", exports: ["createNativeStackNavigator"], pureJs: true },
  // Expanded surface — native modules that typically crash RN unit tests
  { name: "@react-native-community/netinfo", exports: ["default", "addEventListener", "fetch"], shim: "netinfo" },
  { name: "@react-native-clipboard/clipboard", exports: ["getString", "setString"], shim: "clipboard" },
  {
    name: "@react-native-community/datetimepicker",
    exports: ["default"],
    shim: "datetimepicker",
  },
  { name: "@react-native-community/slider", exports: ["default"], shim: "slider" },
  { name: "@react-native-picker/picker", exports: ["Picker"], shim: "picker" },
  { name: "@shopify/flash-list", exports: ["FlashList"], shim: "flash-list" },
  { name: "react-native-pager-view", exports: ["default"], shim: "pager-view" },
  { name: "lottie-react-native", exports: ["default"], shim: "lottie" },
  { name: "react-native-fast-image", exports: ["default"], shim: "fast-image" },
  { name: "react-native-permissions", exports: ["check", "request", "PERMISSIONS"], shim: "permissions" },
  { name: "react-native-localize", exports: ["getLocales", "getCountry"], shim: "localize" },
  { name: "react-native-get-random-values", shim: "get-random-values", sideEffect: true },
  { name: "react-native-url-polyfill", pureJs: true, sideEffect: true },
  { name: "@react-native-masked-view/masked-view", exports: ["default"], shim: "masked-view" },
  { name: "react-native-keyboard-controller", exports: ["KeyboardProvider"], shim: "keyboard-controller" },
  { name: "moti", exports: ["MotiView"], shim: "moti" },
  { name: "react-native-modal", exports: ["default"], pureJs: true },
  { name: "@gorhom/bottom-sheet", exports: ["BottomSheetModalProvider", "BottomSheet"], shim: "bottom-sheet" },
  { name: "i18next", exports: ["default"], pureJs: true },
  { name: "react-i18next", exports: ["useTranslation", "I18nextProvider"], pureJs: true },
];

/** Regexes that find deep react-native imports in JS/TS sources. */
export const DEEP_IMPORT_PATTERNS = [
  /(?:from|require\s*\()\s*['"](react-native\/Libraries\/[^'"]+)['"]/g,
  /(?:from|require\s*\()\s*['"](react-native\/src\/[^'"]+)['"]/g,
] as const;

/** Extensions scanned for deep imports. */
export const SCAN_EXTS = new Set([".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"]);
