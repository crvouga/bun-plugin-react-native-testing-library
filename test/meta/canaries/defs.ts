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
];
