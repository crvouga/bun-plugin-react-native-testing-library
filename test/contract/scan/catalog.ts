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
  /**
   * Coverage status for the compatibility confidence gate.
   * - behavioral: import + state-model evidence
   * - import-only: require/export surface only
   * - unsupported: documented non-goals (must throw clearly if exercised)
   */
  status?: "behavioral" | "import-only" | "unsupported";
};

/**
 * Direct sandbox dependencies that are tooling/infra and must not be treated as
 * product packages that need catalog/shim coverage.
 */
export const INFRA_ALLOWLIST = new Set([
  "bun-plugin-react-native-testing-library",
  "@testing-library/react-native",
  "react",
  "react-native",
  "test-renderer",
  "react-test-renderer",
  "typescript",
  "@types/react",
  "fast-check",
  // Peer/transitive UI helpers pulled as direct deps in the sandbox
  "react-redux",
  "@react-navigation/bottom-tabs",
]);

/** Catalog for test/real-world. */
export const REAL_WORLD_CATALOG: readonly CatalogEntry[] = [
  {
    name: "react-native-reanimated",
    exports: ["default", "useSharedValue", "withTiming"],
    shim: "reanimated",
    status: "behavioral",
  },
  { name: "react-native-worklets", exports: ["runOnJS", "runOnUI"], shim: "worklets", status: "import-only" },
  {
    name: "react-native-gesture-handler",
    exports: ["GestureHandlerRootView"],
    shim: "gesture-handler",
    status: "behavioral",
  },
  {
    name: "react-native-safe-area-context",
    exports: ["SafeAreaProvider", "useSafeAreaInsets"],
    shim: "safe-area",
    status: "behavioral",
  },
  { name: "react-native-screens", exports: ["enableScreens", "Screen"], shim: "screens", status: "import-only" },
  {
    name: "@react-native-async-storage/async-storage",
    exports: ["default", "setItem", "getItem"],
    shim: "async-storage",
    status: "behavioral",
  },
  { name: "@shopify/react-native-skia", exports: ["Canvas", "Circle"], shim: "skia", status: "import-only" },
  { name: "react-native-mmkv", exports: ["createMMKV"], shim: "mmkv", status: "behavioral" },
  { name: "react-native-device-info", exports: ["default", "getBrand"], shim: "device-info", status: "import-only" },
  { name: "react-native-linear-gradient", exports: ["default"], shim: "linear-gradient", status: "import-only" },
  { name: "react-native-webview", exports: ["default"], shim: "webview", status: "import-only" },
  { name: "react-native-svg", exports: ["default"], shim: "svg", status: "import-only" },
  { name: "react-native-paper", exports: ["Provider", "Button"], pureJs: true, status: "import-only" },
  { name: "zustand", exports: ["create"], pureJs: true, status: "import-only" },
  { name: "@tanstack/react-query", exports: ["QueryClient", "useQuery"], pureJs: true, status: "import-only" },
  { name: "@reduxjs/toolkit", exports: ["configureStore", "createSlice"], pureJs: true, status: "import-only" },
  { name: "react-hook-form", exports: ["useForm"], pureJs: true, status: "import-only" },
  { name: "@react-navigation/native", exports: ["NavigationContainer"], pureJs: true, status: "behavioral" },
  {
    name: "@react-navigation/native-stack",
    exports: ["createNativeStackNavigator"],
    pureJs: true,
    status: "behavioral",
  },
  {
    name: "@react-native-community/netinfo",
    exports: ["default", "addEventListener", "fetch"],
    shim: "netinfo",
    status: "behavioral",
  },
  {
    name: "@react-native-clipboard/clipboard",
    exports: ["getString", "setString"],
    shim: "clipboard",
    status: "behavioral",
  },
  {
    name: "@react-native-community/datetimepicker",
    exports: ["default"],
    shim: "datetimepicker",
    status: "import-only",
  },
  { name: "@react-native-community/slider", exports: ["default"], shim: "slider", status: "behavioral" },
  { name: "@react-native-picker/picker", exports: ["Picker"], shim: "picker", status: "behavioral" },
  { name: "@shopify/flash-list", exports: ["FlashList"], shim: "flash-list", status: "behavioral" },
  { name: "react-native-pager-view", exports: ["default"], shim: "pager-view", status: "import-only" },
  { name: "lottie-react-native", exports: ["default"], shim: "lottie", status: "import-only" },
  { name: "react-native-fast-image", exports: ["default"], shim: "fast-image", status: "import-only" },
  {
    name: "react-native-permissions",
    exports: ["check", "request", "PERMISSIONS"],
    shim: "permissions",
    status: "behavioral",
  },
  { name: "react-native-localize", exports: ["getLocales", "getCountry"], shim: "localize", status: "import-only" },
  { name: "react-native-get-random-values", shim: "get-random-values", sideEffect: true, status: "import-only" },
  { name: "react-native-url-polyfill", pureJs: true, sideEffect: true, status: "import-only" },
  { name: "@react-native-masked-view/masked-view", exports: ["default"], shim: "masked-view", status: "import-only" },
  {
    name: "react-native-keyboard-controller",
    exports: ["KeyboardProvider"],
    shim: "keyboard-controller",
    status: "import-only",
  },
  { name: "moti", exports: ["MotiView"], shim: "moti", status: "import-only" },
  { name: "react-native-modal", exports: ["default"], pureJs: true, status: "import-only" },
  {
    name: "@gorhom/bottom-sheet",
    exports: ["BottomSheetModalProvider", "BottomSheet"],
    shim: "bottom-sheet",
    status: "import-only",
  },
  { name: "i18next", exports: ["default"], pureJs: true, status: "import-only" },
  { name: "react-i18next", exports: ["useTranslation", "I18nextProvider"], pureJs: true, status: "import-only" },
  // High-impact ecosystem (added by compatibility confidence gate)
  { name: "react-native-maps", exports: ["default", "Marker"], shim: "maps", status: "import-only" },
  { name: "react-native-video", exports: ["default"], shim: "video", status: "import-only" },
  {
    name: "react-native-image-picker",
    exports: ["launchCamera", "launchImageLibrary"],
    shim: "image-picker",
    status: "import-only",
  },
  { name: "react-native-share", exports: ["default", "open"], shim: "share", status: "import-only" },
  { name: "react-native-bootsplash", exports: ["hide", "isVisible"], shim: "bootsplash", status: "import-only" },
  {
    name: "react-native-keychain",
    exports: ["setGenericPassword", "getGenericPassword"],
    shim: "keychain",
    status: "behavioral",
  },
  { name: "react-native-biometrics", exports: ["default"], shim: "biometrics", status: "import-only" },
  { name: "react-native-config", exports: ["default"], shim: "config", status: "import-only" },
  {
    name: "react-native-vision-camera",
    exports: ["Camera", "useCameraDevice"],
    shim: "vision-camera",
    status: "import-only",
  },
  { name: "@react-native-firebase/app", exports: ["default", "firebase"], shim: "firebase-app", status: "import-only" },
  { name: "@react-native-firebase/auth", exports: ["default"], shim: "firebase-auth", status: "import-only" },
  { name: "@react-native-firebase/firestore", exports: ["default"], shim: "firebase-firestore", status: "import-only" },
  { name: "@react-native-firebase/messaging", exports: ["default"], shim: "firebase-messaging", status: "import-only" },
  { name: "@react-native-firebase/analytics", exports: ["default"], shim: "firebase-analytics", status: "import-only" },
  {
    name: "@react-native-firebase/crashlytics",
    exports: ["default"],
    shim: "firebase-crashlytics",
    status: "import-only",
  },
  {
    name: "@react-native-google-signin/google-signin",
    exports: ["GoogleSignin"],
    shim: "google-signin",
    status: "import-only",
  },
  {
    name: "@stripe/stripe-react-native",
    exports: ["StripeProvider", "useStripe"],
    shim: "stripe",
    status: "import-only",
  },
  {
    name: "expo-web-browser",
    exports: ["openBrowserAsync", "maybeCompleteAuthSession"],
    shim: "expo-web-browser",
    status: "import-only",
  },
  {
    name: "expo-auth-session",
    exports: ["useAuthRequest", "makeRedirectUri"],
    shim: "expo-auth-session",
    status: "import-only",
  },
];

/** Regexes that find deep react-native imports in JS/TS sources. */
export const DEEP_IMPORT_PATTERNS = [
  /(?:from|require\s*\()\s*['"](react-native\/Libraries\/[^'"]+)['"]/g,
  /(?:from|require\s*\()\s*['"](react-native\/src\/[^'"]+)['"]/g,
] as const;

/** Native-surface discovery patterns (must map to a registry shim capability). */
export const NATIVE_SURFACE_PATTERNS = [
  /TurboModuleRegistry\s*\.\s*get(?:Enforcing)?\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  /NativeModules\s*\.\s*([A-Za-z_][A-Za-z0-9_]*)/g,
  /codegenNativeComponent\s*\(\s*['"]([^'"]+)['"]/g,
  /requireNativeComponent\s*\(\s*['"]([^'"]+)['"]/g,
] as const;

/** Extensions scanned for deep imports / native surfaces. */
export const SCAN_EXTS = new Set([".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"]);
