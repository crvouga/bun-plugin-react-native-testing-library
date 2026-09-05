import type { LibraryShim } from "./helpers.ts";
import { mockBoth, tryRequire, loadConsumerReact } from "./helpers.ts";

export const safeAreaShim: LibraryShim = {
  name: "safe-area",
  packages: ["react-native-safe-area-context"],
  register({ cwd, config }) {
    const official =
      tryRequire("react-native-safe-area-context/jest/mock", cwd) ??
      tryRequire("react-native-safe-area-context/lib/commonjs/jest/mock", cwd);

    if (official) {
      mockBoth("react-native-safe-area-context", () => official, cwd);
      return;
    }

    if (config.debug) {
      console.warn("[rn-bun] safe-area-context jest mock missing; using fallback");
    }

    const React = loadConsumerReact();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const RN = require("react-native") as typeof import("react-native");
    const insets = {
      top: 47,
      right: 0,
      bottom: 34,
      left: 0,
    };
    const frame = {
      x: 0,
      y: 0,
      width: config.window.width,
      height: config.window.height,
    };

    mockBoth(
      "react-native-safe-area-context",
      () => ({
        SafeAreaProvider: ({ children }: { children?: React.ReactNode }) =>
          React.createElement(RN.View, { style: { flex: 1 } }, children),
        SafeAreaView: RN.SafeAreaView ?? RN.View,
        SafeAreaInsetsContext: React.createContext(insets),
        SafeAreaFrameContext: React.createContext(frame),
        useSafeAreaInsets: () => insets,
        useSafeAreaFrame: () => frame,
        initialWindowMetrics: { insets, frame },
        MetricsContext: React.createContext({ insets, frame }),
      }),
      cwd,
    );
  },
};

export const screensShim: LibraryShim = {
  name: "screens",
  packages: ["react-native-screens"],
  register({ cwd }) {
    const React = loadConsumerReact();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const RN = require("react-native") as typeof import("react-native");

    const Screen = ({ children, ...rest }: Record<string, unknown> & { children?: React.ReactNode }) =>
      React.createElement(RN.View, { ...rest }, children);
    Screen.displayName = "Screen";

    const passthrough = (name: string) => {
      const C = ({ children, ...rest }: Record<string, unknown> & { children?: React.ReactNode }) =>
        React.createElement(RN.View, { ...rest }, children);
      C.displayName = name;
      return C;
    };

    const featureFlags = {
      experiment: {
        synchronousScreenUpdatesEnabled: false,
        synchronousHeaderConfigUpdatesEnabled: false,
        synchronousHeaderSubviewUpdatesEnabled: false,
        androidLegacyTopInsetBehavior: false,
        androidResetScreenShadowStateOnOrientationChangeEnabled: false,
        iosPreventReattachmentOfDismissedScreens: true,
        iosPreventReattachmentOfDismissedModals: true,
        ios26AllowInteractionsDuringTransition: true,
      },
      stable: {
        debugLogging: false,
      },
    };

    const api = {
      enableScreens: () => {},
      enableFreeze: () => {},
      screensEnabled: () => false,
      freezeEnabled: () => false,
      Screen,
      ScreenContainer: passthrough("ScreenContainer"),
      ScreenStack: passthrough("ScreenStack"),
      ScreenStackHeaderConfig: passthrough("ScreenStackHeaderConfig"),
      ScreenStackHeaderSubview: passthrough("ScreenStackHeaderSubview"),
      SearchBar: passthrough("SearchBar"),
      FullWindowOverlay: passthrough("FullWindowOverlay"),
      InnerScreen: Screen,
      ScreenContext: React.createContext(Screen),
      useTransitionProgress: () => ({ progress: { value: 0 }, closing: { value: 0 }, goingForward: { value: 0 } }),
      featureFlags,
      compatibilityFlags: {},
    };

    mockBoth("react-native-screens", () => api, cwd);
  },
};
