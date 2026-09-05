/**
 * Deliberate sabotages that the suite must catch (anti-cheat).
 */

export interface Canary {
  id: string;
  description: string;
  file: string;
  find: string;
  replace: string;
  /** Focused bun test paths that exercise the sabotaged code. */
  probe: string[];
}

export const CANARIES: Canary[] = [
  {
    id: "pressable-ignores-disabled",
    description: "Pressable reports accessibilityState.disabled=false even when disabled",
    file: "src/mocks/components.ts",
    find: "disabled: isDisabled,\n      },\n      disabled: isDisabled,",
    replace: "disabled: false,\n      },\n      disabled: false,",
    probe: ["test/meta/canaries/probes/pressable-disabled.test.tsx"],
  },
  {
    id: "flatlist-drops-last",
    description: "FlatList/VirtualizedList omits the last row",
    file: "src/mocks/lists.ts",
    find: ": data.flatMap((item, index) => {",
    replace: ": data.slice(0, -1).flatMap((item, index) => {",
    probe: ["test/meta/canaries/probes/flatlist-count.test.tsx"],
  },
  {
    id: "textinput-drops-value",
    description: "TextInput host omits the value prop",
    file: "src/mocks/components.ts",
    find: 'return React.createElement("TextInput", rest, children);',
    replace: 'const { value: _v, ...r } = rest; return React.createElement("TextInput", r, children);',
    probe: ["test/meta/canaries/probes/textinput-value.test.tsx"],
  },
  {
    id: "async-timer-noop",
    description: "advanceTimersByTimeAsync becomes a no-op",
    file: "src/jest-shims.ts",
    find: "existing.advanceTimersByTimeAsync = async (ms: number) => {\n      const fn = existing.advanceTimersByTime as ((n: number) => void) | undefined;\n      fn?.(ms);\n    };",
    replace: "existing.advanceTimersByTimeAsync = async (_ms: number) => {\n      /* sabotaged no-op */\n    };",
    probe: ["test/property/timers.test.tsx"],
  },
  {
    id: "async-storage-get-null",
    description: "async-storage Map fallback getItem always returns null",
    file: "src/libraries/storage.ts",
    find: "getItem: async (k: string) => store.get(k) ?? null,",
    replace: "getItem: async (_k: string) => null,",
    probe: ["test/meta/canaries/probes/async-storage-get.test.ts"],
  },
  {
    id: "netinfo-always-offline",
    description: "NetInfo initial state reports isConnected: false",
    file: "src/libraries/native-extras.ts",
    find: "isConnected: true,",
    replace: "isConnected: false,",
    probe: ["test/meta/canaries/probes/netinfo-connected.test.ts"],
  },
  {
    id: "clipboard-get-empty",
    description: "Clipboard getString always returns empty string",
    file: "src/libraries/native-extras.ts",
    find: "getString: async () => clipboardValue,",
    replace: 'getString: async () => "",',
    probe: ["test/meta/canaries/probes/clipboard-roundtrip.test.ts"],
  },
  {
    id: "flashlist-drops-last",
    description: "FlashList omits the last row",
    file: "src/libraries/native-extras.ts",
    find: "!data || data.length === 0\n          ? [renderComp(ListEmptyComponent)]\n          : data.flatMap((item, index) => {",
    replace:
      "!data || data.length === 0\n          ? [renderComp(ListEmptyComponent)]\n          : data.slice(0, -1).flatMap((item, index) => {",
    probe: ["test/meta/canaries/probes/flashlist-count.test.tsx"],
  },
  {
    id: "deep-path-process-color-empty",
    description: "DEEP_PATHS processColor factory returns empty module",
    file: "src/mocks/index.ts",
    find: '"react-native/Libraries/StyleSheet/processColor": () => ({\n    default: (c: unknown) => c,\n    processColor: (c: unknown) => c,\n    __esModule: true,\n  }),',
    replace: '"react-native/Libraries/StyleSheet/processColor": () => ({}),',
    probe: ["test/meta/canaries/probes/deep-path-process-color.test.ts"],
  },
];
