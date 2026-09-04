import type { LibraryShim } from "./helpers.ts";
import { mockBoth, tryRequire, loadConsumerReact } from "./helpers.ts";

function hostFallback(configDebug: boolean) {
  if (configDebug) {
    console.warn("[rn-bun] skia CanvasKit init failed; using host-component fallback");
  }
  const React = loadConsumerReact();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const RN = require("react-native") as typeof import("react-native");

  const host = (name: string) => {
    const C = ({ children, ...rest }: Record<string, unknown> & { children?: React.ReactNode }) =>
      React.createElement(RN.View, { ...rest, accessibilityLabel: name }, children);
    C.displayName = name;
    return C;
  };

  const PathMake = () => ({
    moveTo: () => PathMake(),
    lineTo: () => PathMake(),
    cubicTo: () => PathMake(),
    quadTo: () => PathMake(),
    close: () => PathMake(),
    addCircle: () => PathMake(),
    addRect: () => PathMake(),
  });

  return {
    Canvas: host("Canvas"),
    Group: host("Group"),
    Circle: host("Circle"),
    Rect: host("Rect"),
    RoundedRect: host("RoundedRect"),
    Path: host("Path"),
    Line: host("Line"),
    Text: host("SkiaText"),
    Fill: host("Fill"),
    Image: host("SkiaImage"),
    LinearGradient: host("LinearGradient"),
    RadialGradient: host("RadialGradient"),
    BlurMask: host("BlurMask"),
    Mask: host("Mask"),
    ClipOp: { Difference: 0, Intersect: 1 },
    Skia: {
      Path: { Make: PathMake, MakeFromSVGString: () => PathMake() },
      Color: (c: unknown) => c,
      Paint: () => ({ setColor: () => {}, setStyle: () => {}, setStrokeWidth: () => {} }),
      XYWHRect: (x: number, y: number, w: number, h: number) => ({ x, y, w, h }),
      Point: (x: number, y: number) => ({ x, y }),
      RuntimeEffect: { Make: () => null },
    },
    matchFont: () => null,
    useFont: () => null,
    useCanvasRef: () => ({ current: null }),
    useValue: (v: unknown) => ({ current: v }),
    useComputedValue: (fn: () => unknown) => ({ current: fn() }),
    useSharedValueEffect: () => {},
    vec: (x: number, y: number) => ({ x, y }),
    rect: (x: number, y: number, w: number, h: number) => ({ x, y, width: w, height: h }),
    rrect: (r: unknown, rx: number, ry: number) => ({ rect: r, rx, ry }),
  };
}

export const skiaShim: LibraryShim = {
  name: "skia",
  packages: ["@shopify/react-native-skia"],
  register({ cwd, config }) {
    const factory = () => {
      try {
        // Prefer official Mock(CanvasKit) when canvaskit-wasm is available.
        const mockMod = tryRequire("@shopify/react-native-skia/lib/commonjs/mock", cwd) as {
          Mock?: (ck: unknown) => unknown;
        } | null;
        if (mockMod?.Mock) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const CanvasKitInit = require(Bun.resolveSync("canvaskit-wasm/bin/full/canvaskit.js", cwd));
            // Sync path unavailable — CanvasKitInit is async. Fall through to host.
            // Attempt sync-like: some builds expose .default as factory returning Promise.
            void CanvasKitInit;
            if (config.debug) {
              console.log("[rn-bun] skia: canvaskit present but async init; using host fallback for sync preload");
            }
          } catch {
            // no canvaskit
          }
        }
      } catch {
        // ignore
      }
      return hostFallback(config.debug);
    };

    mockBoth("@shopify/react-native-skia", factory, cwd);
    mockBoth("@shopify/react-native-skia/lib/module", factory, cwd);
  },
};

export const mmkvShim: LibraryShim = {
  name: "mmkv",
  packages: ["react-native-mmkv"],
  register({ cwd, config }) {
    const React = loadConsumerReact();

    const createMockMMKV = tryRequire("react-native-mmkv/lib/createMMKV/createMockMMKV", cwd) as {
      createMockMMKV?: () => Record<string, unknown>;
      default?: () => Record<string, unknown>;
    } | null;

    type MmkvStore = {
      getString: (k: string) => string | undefined;
      getNumber: (k: string) => number | undefined;
      getBoolean: (k: string) => boolean | undefined;
      getBuffer: (k: string) => ArrayBuffer | undefined;
      set: (k: string, v: string | number | boolean | ArrayBuffer) => void;
      remove: (k: string) => boolean;
      contains: (k: string) => boolean;
      getAllKeys: () => string[];
      clearAll: () => void;
      recrypt: () => void;
      readonly size: number;
      addOnValueChangedListener: () => { remove: () => void };
    };

    function makeStore(): MmkvStore {
      if (createMockMMKV?.createMockMMKV) return createMockMMKV.createMockMMKV() as MmkvStore;
      if (typeof createMockMMKV?.default === "function") return createMockMMKV.default() as MmkvStore;

      if (config.debug) {
        console.warn("[rn-bun] mmkv createMockMMKV missing; using Map store");
      }
      const map = new Map<string, string | number | boolean | ArrayBuffer>();
      return {
        getString: (k: string) => {
          const v = map.get(k);
          return typeof v === "string" ? v : undefined;
        },
        getNumber: (k: string) => {
          const v = map.get(k);
          return typeof v === "number" ? v : undefined;
        },
        getBoolean: (k: string) => {
          const v = map.get(k);
          return typeof v === "boolean" ? v : undefined;
        },
        getBuffer: (k: string) => {
          const v = map.get(k);
          return v instanceof ArrayBuffer ? v : undefined;
        },
        set: (k: string, v: string | number | boolean | ArrayBuffer) => {
          map.set(k, v);
        },
        remove: (k: string) => map.delete(k),
        contains: (k: string) => map.has(k),
        getAllKeys: () => [...map.keys()],
        clearAll: () => map.clear(),
        recrypt: () => {},
        get size() {
          return map.size;
        },
        addOnValueChangedListener: () => ({ remove: () => {} }),
      };
    }

    const instances = new Map<string, MmkvStore>();
    function createMMKV(id = "mmkv.default") {
      if (!instances.has(id)) instances.set(id, makeStore());
      return instances.get(id)!;
    }

    function useMMKVString(key: string, instance?: MmkvStore) {
      const mmkv = instance ?? createMMKV();
      const [value, setValue] = React.useState(() => mmkv.getString(key));
      const set = React.useCallback(
        (v: string | undefined) => {
          if (v === undefined) mmkv.remove(key);
          else mmkv.set(key, v);
          setValue(v);
        },
        [key, mmkv],
      );
      return [value, set] as const;
    }

    function useMMKVNumber(key: string, instance?: MmkvStore) {
      const mmkv = instance ?? createMMKV();
      const [value, setValue] = React.useState(() => mmkv.getNumber(key));
      const set = React.useCallback(
        (v: number | undefined) => {
          if (v === undefined) mmkv.remove(key);
          else mmkv.set(key, v);
          setValue(v);
        },
        [key, mmkv],
      );
      return [value, set] as const;
    }

    function useMMKVBoolean(key: string, instance?: MmkvStore) {
      const mmkv = instance ?? createMMKV();
      const [value, setValue] = React.useState(() => mmkv.getBoolean(key));
      const set = React.useCallback(
        (v: boolean | undefined) => {
          if (v === undefined) mmkv.remove(key);
          else mmkv.set(key, v);
          setValue(v);
        },
        [key, mmkv],
      );
      return [value, set] as const;
    }

    function useMMKVObject<T>(key: string, instance?: MmkvStore) {
      const [raw, setRaw] = useMMKVString(key, instance);
      const value = raw ? (JSON.parse(raw) as T) : undefined;
      const set = (v: T | undefined) => setRaw(v === undefined ? undefined : JSON.stringify(v));
      return [value, set] as const;
    }

    const api = {
      createMMKV,
      useMMKV: createMMKV,
      useMMKVString,
      useMMKVNumber,
      useMMKVBoolean,
      useMMKVObject,
      useMMKVBuffer: useMMKVString,
      MMKV: class MMKV {
        #id: string;
        constructor(opts?: { id?: string }) {
          this.#id = opts?.id ?? "mmkv.default";
        }
        get #store() {
          return createMMKV(this.#id);
        }
        getString(k: string) {
          return this.#store.getString(k);
        }
        getNumber(k: string) {
          return this.#store.getNumber(k);
        }
        getBoolean(k: string) {
          return this.#store.getBoolean(k);
        }
        set(k: string, v: string | number | boolean | ArrayBuffer) {
          this.#store.set(k, v);
        }
        remove(k: string) {
          return this.#store.remove(k);
        }
        contains(k: string) {
          return this.#store.contains(k);
        }
        getAllKeys() {
          return this.#store.getAllKeys();
        }
        clearAll() {
          this.#store.clearAll();
        }
      },
    };

    mockBoth("react-native-mmkv", () => api, cwd);
  },
};
