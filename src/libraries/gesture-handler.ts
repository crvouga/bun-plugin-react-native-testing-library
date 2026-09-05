import type { LibraryShim } from "./helpers.ts";
import { mockBoth, tryRequire, loadConsumerReact } from "./helpers.ts";

/**
 * Translate gesture-handler's jestSetup.js into mock.module calls against
 * the shipped `lib/module/mocks/*` modules, plus a View-based root fallback.
 */
export const gestureHandlerShim: LibraryShim = {
  name: "gesture-handler",
  packages: ["react-native-gesture-handler"],
  register({ cwd, config }) {
    const pairs: Array<[string, string]> = [
      [
        "react-native-gesture-handler/lib/module/RNGestureHandlerModule",
        "react-native-gesture-handler/lib/module/mocks/module",
      ],
      [
        "react-native-gesture-handler/lib/module/components/GestureButtons",
        "react-native-gesture-handler/lib/module/mocks/GestureButtons",
      ],
      [
        "react-native-gesture-handler/lib/module/components/Pressable",
        "react-native-gesture-handler/lib/module/mocks/Pressable",
      ],
      [
        "react-native-gesture-handler/lib/module/components/GestureComponents",
        "react-native-gesture-handler/lib/module/mocks/gestureComponents",
      ],
      [
        "react-native-gesture-handler/lib/module/components/touchables",
        "react-native-gesture-handler/lib/module/mocks/Touchables",
      ],
      [
        "react-native-gesture-handler/lib/module/v3/detectors/HostGestureDetector",
        "react-native-gesture-handler/lib/module/mocks/hostDetector",
      ],
    ];

    for (const [target, mockPath] of pairs) {
      mockBoth(
        target,
        () => {
          const m = tryRequire(mockPath, cwd);
          if (!m) {
            if (config.debug) console.warn(`[rn-bun] missing GH mock ${mockPath}`);
            return {};
          }
          return m;
        },
        cwd,
      );
    }

    // Always mock the package root — loading the real entry can throw when
    // `__DEV__` / native modules are missing (and require-inside-factory recurses).
    const React = loadConsumerReact();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const RN = require("react-native") as typeof import("react-native");
    void React;
    mockBoth(
      "react-native-gesture-handler",
      () => ({
        GestureHandlerRootView: RN.View,
        GestureDetector: ({ children }: { children?: unknown }) => children ?? null,
        Gesture: {
          Tap: () => ({ onEnd: () => ({}) }),
          Pan: () => ({ onEnd: () => ({}) }),
          LongPress: () => ({ onEnd: () => ({}) }),
        },
        State: { UNDETERMINED: 0, FAILED: 1, BEGAN: 2, CANCELLED: 3, ACTIVE: 4, END: 5 },
        Directions: { RIGHT: 1, LEFT: 2, UP: 4, DOWN: 8 },
        TapGestureHandler: RN.View,
        PanGestureHandler: RN.View,
        LongPressGestureHandler: RN.View,
        NativeViewGestureHandler: RN.View,
        ScrollView: RN.ScrollView,
        FlatList: RN.FlatList,
        TouchableOpacity: RN.TouchableOpacity,
        TouchableHighlight: RN.TouchableHighlight,
        TouchableWithoutFeedback: RN.TouchableWithoutFeedback,
        TouchableNativeFeedback: RN.TouchableNativeFeedback,
        Swipeable: RN.View,
        DrawerLayout: RN.View,
        createNativeWrapper: (c: unknown) => c,
      }),
      cwd,
    );
  },
};
