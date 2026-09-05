/**
 * Shims for popular native-module packages that crash under bun:test
 * without Jest/Metro (NetInfo, Clipboard, pickers, FlashList, etc.).
 */

import type { LibraryShim } from "./helpers.ts";
import { mockBoth, loadConsumerReact } from "./helpers.ts";

function viewHost(displayName: string) {
  const React = loadConsumerReact();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const RN = require("react-native") as typeof import("react-native");
  const C = ({ children, ...rest }: Record<string, unknown> & { children?: React.ReactNode }) =>
    React.createElement(RN.View, rest, children);
  C.displayName = displayName;
  return C;
}

function imageHost(displayName: string) {
  const React = loadConsumerReact();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const RN = require("react-native") as typeof import("react-native");
  const C = (props: Record<string, unknown>) => React.createElement(RN.Image, props);
  C.displayName = displayName;
  return C;
}

/** In-memory NetInfo connectivity model. */
let netInfoState = {
  type: "wifi" as string,
  isConnected: true,
  isInternetReachable: true,
  details: null as unknown,
};

const netInfoListeners = new Set<(s: typeof netInfoState) => void>();

export function __setNetInfoStateForTests(partial: Partial<typeof netInfoState>): void {
  netInfoState = { ...netInfoState, ...partial };
  for (const l of netInfoListeners) l(netInfoState);
}

export const netinfoShim: LibraryShim = {
  name: "netinfo",
  packages: ["@react-native-community/netinfo"],
  register({ cwd }) {
    const React = loadConsumerReact();
    const api = {
      fetch: async () => ({ ...netInfoState }),
      refresh: async () => ({ ...netInfoState }),
      configure: () => {},
      addEventListener: (listener: (s: typeof netInfoState) => void) => {
        netInfoListeners.add(listener);
        return () => {
          netInfoListeners.delete(listener);
        };
      },
      useNetInfo: () => {
        const [s, setS] = React.useState(netInfoState);
        React.useEffect(() => api.addEventListener(setS), []);
        return s;
      },
      NetInfoStateType: {
        unknown: "unknown",
        none: "none",
        cellular: "cellular",
        wifi: "wifi",
        bluetooth: "bluetooth",
        ethernet: "ethernet",
        wimax: "wimax",
        vpn: "vpn",
        other: "other",
      },
    };
    mockBoth("@react-native-community/netinfo", () => ({ default: api, ...api, __esModule: true }), cwd);
  },
};

let clipboardValue = "";

export function __setClipboardForTests(v: string): void {
  clipboardValue = v;
}

export const clipboardShim: LibraryShim = {
  name: "clipboard",
  packages: ["@react-native-clipboard/clipboard"],
  register({ cwd }) {
    const api = {
      getString: async () => clipboardValue,
      setString: async (v: string) => {
        clipboardValue = v;
      },
      hasString: async () => clipboardValue.length > 0,
      getImage: async () => null,
      setImage: async () => {},
      addListener: () => ({ remove: () => {} }),
      removeAllListeners: () => {},
    };
    mockBoth("@react-native-clipboard/clipboard", () => ({ default: api, ...api, __esModule: true }), cwd);
  },
};

export const datetimepickerShim: LibraryShim = {
  name: "datetimepicker",
  packages: ["@react-native-community/datetimepicker"],
  register({ cwd }) {
    const React = loadConsumerReact();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const RN = require("react-native") as typeof import("react-native");
    const DateTimePicker = (props: Record<string, unknown>) =>
      React.createElement(RN.View, { ...props, testID: (props.testID as string) ?? "datetimepicker" });
    DateTimePicker.displayName = "DateTimePicker";
    mockBoth(
      "@react-native-community/datetimepicker",
      () => ({
        default: DateTimePicker,
        DateTimePickerAndroid: { open: () => {}, dismiss: () => {} },
        __esModule: true,
      }),
      cwd,
    );
  },
};

export const sliderShim: LibraryShim = {
  name: "slider",
  packages: ["@react-native-community/slider"],
  register({ cwd }) {
    const React = loadConsumerReact();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const RN = require("react-native") as typeof import("react-native");
    const Slider = (props: Record<string, unknown>) => React.createElement(RN.View, props);
    Slider.displayName = "Slider";
    mockBoth("@react-native-community/slider", () => ({ default: Slider, __esModule: true }), cwd);
  },
};

export const pickerShim: LibraryShim = {
  name: "picker",
  packages: ["@react-native-picker/picker"],
  register({ cwd }) {
    const React = loadConsumerReact();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const RN = require("react-native") as typeof import("react-native");
    const Picker = ({ children, ...rest }: Record<string, unknown> & { children?: React.ReactNode }) =>
      React.createElement(RN.View, rest, children);
    Picker.displayName = "Picker";
    const PickerItem = ({ label, ...rest }: Record<string, unknown>) =>
      React.createElement(RN.Text, rest, label as string);
    PickerItem.displayName = "Picker.Item";
    Picker.Item = PickerItem;
    mockBoth("@react-native-picker/picker", () => ({ Picker, __esModule: true }), cwd);
  },
};

export const flashListShim: LibraryShim = {
  name: "flash-list",
  packages: ["@shopify/flash-list"],
  register({ cwd }) {
    const React = loadConsumerReact();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const RN = require("react-native") as typeof import("react-native");
    const FlashList = React.forwardRef((props: Record<string, unknown>, ref: unknown) => {
      const {
        data = [],
        renderItem,
        keyExtractor,
        ListHeaderComponent,
        ListFooterComponent,
        ListEmptyComponent,
        ItemSeparatorComponent,
        ...rest
      } = props as {
        data?: unknown[];
        renderItem?: (info: { item: unknown; index: number }) => React.ReactNode;
        keyExtractor?: (item: unknown, index: number) => string;
        ListHeaderComponent?: React.ComponentType | React.ReactElement | null;
        ListFooterComponent?: React.ComponentType | React.ReactElement | null;
        ListEmptyComponent?: React.ComponentType | React.ReactElement | null;
        ItemSeparatorComponent?: React.ComponentType | null;
      } & Record<string, unknown>;

      const renderComp = (C: React.ComponentType | React.ReactElement | null | undefined) => {
        if (!C) return null;
        if (React.isValidElement(C)) return C;
        return React.createElement(C as React.ComponentType);
      };

      const rows =
        !data || data.length === 0
          ? [renderComp(ListEmptyComponent)]
          : data.flatMap((item, index) => {
              const row = renderItem?.({ item, index });
              const sep =
                ItemSeparatorComponent && index < data.length - 1 ? React.createElement(ItemSeparatorComponent) : null;
              const key = keyExtractor?.(item, index) ?? String(index);
              return [
                React.createElement(React.Fragment, { key }, row),
                sep ? React.createElement(React.Fragment, { key: `${key}-sep` }, sep) : null,
              ];
            });

      return React.createElement(
        RN.View,
        { ...(rest as object), ref } as React.ComponentProps<typeof RN.View>,
        renderComp(ListHeaderComponent),
        ...rows,
        renderComp(ListFooterComponent),
      );
    });
    FlashList.displayName = "FlashList";
    mockBoth(
      "@shopify/flash-list",
      () => ({ FlashList, useRecyclingState: () => [null, () => {}], __esModule: true }),
      cwd,
    );
  },
};

export const pagerViewShim: LibraryShim = {
  name: "pager-view",
  packages: ["react-native-pager-view"],
  register({ cwd }) {
    const React = loadConsumerReact();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const RN = require("react-native") as typeof import("react-native");
    class PagerView extends React.Component<Record<string, unknown>> {
      static displayName = "PagerView";
      setPage = () => {};
      setPageWithoutAnimation = () => {};
      setScrollEnabled = () => {};
      render() {
        const { children, ...rest } = this.props;
        return React.createElement(RN.View, rest, children as React.ReactNode);
      }
    }
    mockBoth("react-native-pager-view", () => ({ default: PagerView, __esModule: true }), cwd);
  },
};

export const lottieShim: LibraryShim = {
  name: "lottie",
  packages: ["lottie-react-native"],
  register({ cwd }) {
    const C = viewHost("LottieView");
    Object.assign(C, { displayName: "LottieView" });
    (C as { prototype?: unknown } & Function).prototype = {
      play: () => {},
      reset: () => {},
      pause: () => {},
      resume: () => {},
    };
    mockBoth("lottie-react-native", () => ({ default: C, __esModule: true }), cwd);
  },
};

export const fastImageShim: LibraryShim = {
  name: "fast-image",
  packages: ["react-native-fast-image"],
  register({ cwd }) {
    const FastImage = imageHost("FastImage");
    Object.assign(FastImage, {
      resizeMode: { contain: "contain", cover: "cover", stretch: "stretch", center: "center" },
      priority: { low: "low", normal: "normal", high: "high" },
      cacheControl: { immutable: "immutable", web: "web", cacheOnly: "cacheOnly" },
      preload: () => {},
      clearMemoryCache: async () => {},
      clearDiskCache: async () => {},
    });
    mockBoth("react-native-fast-image", () => ({ default: FastImage, __esModule: true }), cwd);
  },
};

export const permissionsShim: LibraryShim = {
  name: "permissions",
  packages: ["react-native-permissions"],
  register({ cwd }) {
    const RESULTS = {
      UNAVAILABLE: "unavailable",
      BLOCKED: "blocked",
      DENIED: "denied",
      GRANTED: "granted",
      LIMITED: "limited",
    } as const;
    const PERMISSIONS = new Proxy(
      {},
      {
        get: (_t, prop) => (typeof prop === "string" ? prop : undefined),
      },
    );
    const api = {
      PERMISSIONS,
      RESULTS,
      check: async () => RESULTS.GRANTED,
      checkMultiple: async (perms: string[]) => Object.fromEntries(perms.map((p) => [p, RESULTS.GRANTED])),
      request: async () => RESULTS.GRANTED,
      requestMultiple: async (perms: string[]) => Object.fromEntries(perms.map((p) => [p, RESULTS.GRANTED])),
      openSettings: async () => {},
      checkNotifications: async () => ({ status: RESULTS.GRANTED, settings: {} }),
      requestNotifications: async () => ({ status: RESULTS.GRANTED, settings: {} }),
      checkLocationAccuracy: async () => "full",
      requestLocationAccuracy: async () => "full",
    };
    mockBoth("react-native-permissions", () => ({ ...api, default: api, __esModule: true }), cwd);
  },
};

export const localizeShim: LibraryShim = {
  name: "localize",
  packages: ["react-native-localize"],
  register({ cwd }) {
    const api = {
      getLocales: () => [{ languageCode: "en", countryCode: "US", languageTag: "en-US", isRTL: false }],
      getNumberFormatSettings: () => ({ decimalSeparator: ".", groupingSeparator: "," }),
      getCalendar: () => "gregorian",
      getCountry: () => "US",
      getCurrencies: () => ["USD"],
      getTemperatureUnit: () => "fahrenheit",
      getTimeZone: () => "America/Los_Angeles",
      uses24HourClock: () => false,
      usesMetricSystem: () => false,
      usesAutoDateAndTime: () => true,
      usesAutoTimeZone: () => true,
      findBestLanguageTag: (tags: string[]) => ({ languageTag: tags[0] ?? "en", isRTL: false }),
      openAppLanguageSettings: async () => {},
      addEventListener: () => ({ remove: () => {} }),
      removeEventListener: () => {},
    };
    mockBoth("react-native-localize", () => ({ ...api, default: api, __esModule: true }), cwd);
  },
};

export const getRandomValuesShim: LibraryShim = {
  name: "get-random-values",
  packages: ["react-native-get-random-values"],
  register({ cwd }) {
    // Side-effect polyfill — ensure crypto.getRandomValues exists.
    const g = globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } };
    if (!g.crypto) g.crypto = {};
    if (typeof g.crypto.getRandomValues !== "function") {
      g.crypto.getRandomValues = <T extends ArrayBufferView>(arr: T): T => {
        const view = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
        for (let i = 0; i < view.length; i++) view[i] = (Math.random() * 256) | 0;
        return arr;
      };
    }
    mockBoth("react-native-get-random-values", () => ({ polyfilled: true, __esModule: true }), cwd);
  },
};

export const maskedViewShim: LibraryShim = {
  name: "masked-view",
  packages: ["@react-native-masked-view/masked-view"],
  register({ cwd }) {
    const C = viewHost("MaskedView");
    mockBoth("@react-native-masked-view/masked-view", () => ({ default: C, __esModule: true }), cwd);
  },
};

export const keyboardControllerShim: LibraryShim = {
  name: "keyboard-controller",
  packages: ["react-native-keyboard-controller"],
  register({ cwd }) {
    const React = loadConsumerReact();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const RN = require("react-native") as typeof import("react-native");
    const KeyboardProvider = ({ children }: { children?: React.ReactNode }) =>
      React.createElement(RN.View, { style: { flex: 1 } }, children);
    KeyboardProvider.displayName = "KeyboardProvider";
    const api = {
      KeyboardProvider,
      KeyboardAwareScrollView: RN.ScrollView,
      KeyboardStickyView: RN.View,
      KeyboardToolbar: RN.View,
      useKeyboardHandler: () => {},
      useKeyboardAnimation: () => ({ height: { value: 0 }, progress: { value: 0 } }),
      useReanimatedKeyboardAnimation: () => ({ height: { value: 0 }, progress: { value: 0 } }),
      useKeyboardController: () => ({ setEnabled: () => {}, enabled: true }),
      KeyboardController: { setInputMode: () => {}, setDefaultMode: () => {}, dismiss: async () => {} },
      AndroidSoftInputModes: {},
    };
    mockBoth("react-native-keyboard-controller", () => ({ ...api, default: api, __esModule: true }), cwd);
  },
};

export const motiShim: LibraryShim = {
  name: "moti",
  packages: ["moti"],
  register({ cwd }) {
    const React = loadConsumerReact();
    // Always host-fallback — real moti may load but still pull fragile reanimated paths.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const RN = require("react-native") as typeof import("react-native");
    const MotiView = ({ children, ...rest }: Record<string, unknown> & { children?: React.ReactNode }) =>
      React.createElement(RN.View, rest, children);
    MotiView.displayName = "MotiView";
    const MotiText = ({ children, ...rest }: Record<string, unknown> & { children?: React.ReactNode }) =>
      React.createElement(RN.Text, rest, children);
    MotiText.displayName = "MotiText";
    mockBoth(
      "moti",
      () => ({
        MotiView,
        MotiText,
        View: MotiView,
        Text: MotiText,
        AnimatePresence: ({ children }: { children?: React.ReactNode }) => children ?? null,
        __esModule: true,
      }),
      cwd,
    );
  },
};

export const bottomSheetShim: LibraryShim = {
  name: "bottom-sheet",
  packages: ["@gorhom/bottom-sheet"],
  register({ cwd }) {
    const React = loadConsumerReact();
    // Always mock — requiring the real package first caches a broken/partial module.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const RN = require("react-native") as typeof import("react-native");
    const BottomSheet = ({ children, ...rest }: Record<string, unknown> & { children?: React.ReactNode }) =>
      React.createElement(RN.View, rest, children);
    BottomSheet.displayName = "BottomSheet";
    const BottomSheetModalProvider = ({ children }: { children?: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children);
    const api = {
      BottomSheet,
      BottomSheetModal: BottomSheet,
      BottomSheetModalProvider,
      BottomSheetView: RN.View,
      BottomSheetScrollView: RN.ScrollView,
      BottomSheetFlatList: RN.FlatList,
      BottomSheetTextInput: RN.TextInput,
      BottomSheetBackdrop: RN.View,
      BottomSheetHandle: RN.View,
      useBottomSheet: () => ({ snapToIndex: () => {}, close: () => {}, expand: () => {}, collapse: () => {} }),
      useBottomSheetModal: () => ({ dismiss: () => {}, present: () => {} }),
    };
    mockBoth("@gorhom/bottom-sheet", () => ({ ...api, __esModule: true }), cwd);
  },
};
