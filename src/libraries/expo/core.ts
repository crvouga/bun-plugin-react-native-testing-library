/**
 * Expo modules-core shim — jest-expo-compatible requireNativeModule under bun:test.
 */

import { readdirSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { mock } from "bun:test";
import type { LibraryShim } from "../helpers.ts";
import { mockBoth, tryRequire, loadConsumerReact, packageResolves } from "../helpers.ts";
import { createHostComponent, asyncNoop, noop } from "../../mocks/host.ts";

type PropDef = {
  type?: string;
  functionType?: string;
  mock?: unknown;
  mockDefinition?: Record<string, Record<string, PropDef>>;
};

function bunFn(impl?: (...args: unknown[]) => unknown) {
  try {
    return mock(impl ?? (() => undefined));
  } catch {
    const f = (...args: unknown[]) => (impl ? impl(...args) : undefined);
    (f as { _isMockFunction?: boolean })._isMockFunction = true;
    return f;
  }
}

function mockProp(property: PropDef, customMock?: unknown): unknown {
  if (customMock !== undefined) return customMock;
  const t = property.type;
  if (t === "function") {
    if (property.functionType === "promise") return bunFn(() => Promise.resolve());
    return bunFn();
  }
  if (t === "number") return 1;
  if (t === "string") return "mock";
  if (t === "array") return [];
  if (t === "mock" && property.mockDefinition) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(property.mockDefinition)) {
      out[k] = mockProperties(v);
    }
    return out;
  }
  if (property.mock !== undefined) return property.mock;
  return {};
}

function mockProperties(moduleProperties: Record<string, PropDef>, customMocks?: Record<string, unknown>) {
  const mocked: Record<string, unknown> = {};
  for (const [name, property] of Object.entries(moduleProperties)) {
    mocked[name] = mockProp(property, customMocks?.[name]);
  }
  return mocked;
}

function loadJestExpoTables(cwd: string): Record<string, Record<string, PropDef>> {
  const merged: Record<string, Record<string, PropDef>> = {};
  for (const rel of [
    "jest-expo/src/preset/moduleMocks/expoModules.js",
    "jest-expo/src/preset/moduleMocks/internalExpoModules.js",
    "jest-expo/src/preset/moduleMocks/thirdPartyModules.js",
    "jest-expo/build/preset/moduleMocks/expoModules.js",
  ]) {
    const mod = tryRequire(rel, cwd) as Record<string, Record<string, PropDef>> | null;
    if (mod && typeof mod === "object") Object.assign(merged, mod);
  }
  return merged;
}

function indexPackageMocks(cwd: string): Map<string, string> {
  const out = new Map<string, string>();
  const nm = join(cwd, "node_modules");
  if (!existsSync(nm)) return out;

  const scanPkg = (pkgDir: string) => {
    const mocksDir = join(pkgDir, "mocks");
    if (!existsSync(mocksDir)) return;
    for (const name of readdirSync(mocksDir)) {
      const base = name.replace(/\.(tsx?|jsx?|mjs|cjs)$/, "");
      const full = join(mocksDir, name);
      out.set(base, full);
      // Also index without Expo prefix variants
      if (base.startsWith("Expo")) out.set(base.slice(4), full);
    }
  };

  for (const entry of readdirSync(nm)) {
    const p = join(nm, entry);
    if (entry.startsWith("expo-") || entry === "expo") scanPkg(p);
    if (entry === "@expo") {
      try {
        for (const sub of readdirSync(p)) scanPkg(join(p, sub));
      } catch {
        // ignore
      }
    }
  }
  return out;
}

function autoProxyModule(): Record<string, unknown> {
  return new Proxy(
    {},
    {
      get(_t, prop) {
        if (typeof prop !== "string") return undefined;
        if (prop === "then") return undefined;
        if (prop.startsWith("add") || prop.includes("Listener")) {
          return bunFn(() => ({ remove: noop }));
        }
        return bunFn(() => Promise.resolve());
      },
    },
  );
}

export const expoCoreShim: LibraryShim = {
  name: "expo",
  packages: ["expo-modules-core"],
  register({ cwd, config }) {
    const React = loadConsumerReact();
    const tables = loadJestExpoTables(cwd);
    const packageMocks = indexPackageMocks(cwd);
    const moduleCache = new Map<string, Record<string, unknown>>();

    // Install expo global polyfill when available (web implementations of EventEmitter etc.)
    try {
      const poly = tryRequire("expo-modules-core/src/polyfill/dangerous-internal", cwd) as {
        installExpoGlobalPolyfill?: () => void;
      } | null;
      poly?.installExpoGlobalPolyfill?.();
    } catch {
      // ignore
    }

    const g = globalThis as typeof globalThis & {
      expo?: {
        modules?: Record<string, unknown>;
        EventEmitter?: unknown;
        NativeModule?: new () => Record<string, unknown>;
        SharedObject?: new () => Record<string, unknown>;
      };
    };
    if (!g.expo) g.expo = {};
    if (!g.expo.modules) g.expo.modules = {};

    // Seed NativeModules-style table onto global.expo.modules
    for (const [moduleName, props] of Object.entries(tables)) {
      if (moduleName === "NativeUnimoduleProxy") continue;
      g.expo.modules[moduleName] = mockProperties(props);
    }

    // Ensure ExpoFetchModule stubs exist (expo/fetch extends these)
    if (!g.expo.modules.ExpoFetchModule) {
      g.expo.modules.ExpoFetchModule = {
        NativeRequest: class {
          start = noop;
          cancel = noop;
        },
        NativeResponse: class {
          startStreaming = noop;
          cancelStreaming = noop;
          arrayBuffer = asyncNoop;
          text = asyncNoop;
        },
      };
    }

    function loadPackageMock(name: string): Record<string, unknown> | null {
      const path = packageMocks.get(name);
      if (!path) return null;
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        return require(path) as Record<string, unknown>;
      } catch {
        return null;
      }
    }

    function requireMockModule(name: string): Record<string, unknown> | null {
      if (moduleCache.has(name)) return moduleCache.get(name)!;

      const fromPkg = loadPackageMock(name);
      const fromTable = tables[name] ? mockProperties(tables[name]!) : null;
      const fromGlobal = (g.expo?.modules?.[name] as Record<string, unknown> | undefined) ?? null;

      let base = fromPkg ?? fromTable ?? fromGlobal;
      if (!base) base = autoProxyModule();

      const NativeModuleCtor =
        (g.expo?.NativeModule as (new () => Record<string, unknown>) | undefined) ??
        (class {
          /* empty */
        } as unknown as new () => Record<string, unknown>);

      const nativeModule: Record<string, unknown> = new NativeModuleCtor();
      for (const [key, value] of Object.entries(base)) {
        if (typeof value === "function") {
          const isClass = Object.getOwnPropertyNames((value as { prototype?: object }).prototype ?? {}).length > 1;
          nativeModule[key] = isClass ? value : bunFn(value as (...a: unknown[]) => unknown);
        } else {
          nativeModule[key] = value;
        }
      }
      moduleCache.set(name, nativeModule);
      g.expo!.modules![name] = nativeModule;
      return nativeModule;
    }

    const actual = tryRequire("expo-modules-core", cwd) as Record<string, unknown> | null;

    const factory = () => {
      const EventEmitter = g.expo?.EventEmitter ?? actual?.EventEmitter;
      const NativeModule = g.expo?.NativeModule ?? actual?.NativeModule;
      const SharedObject = g.expo?.SharedObject ?? actual?.SharedObject;

      return {
        ...(actual ?? {}),
        EventEmitter,
        NativeModule,
        SharedObject,
        createSnapshotFriendlyRef: () => {
          const ref = { current: null as unknown };
          Object.defineProperty(ref, "toJSON", { value: () => "[React.ref]" });
          return ref;
        },
        requireOptionalNativeModule: (name: string) => requireMockModule(name),
        requireNativeModule: (name: string) => {
          const m = requireMockModule(name);
          if (!m) throw new Error(`Cannot find native module '${name}'`);
          return m;
        },
        requireNativeViewManager: (name: string) => {
          const pkg = loadPackageMock(name);
          if (pkg && typeof (pkg as { View?: unknown }).View !== "undefined") {
            return (pkg as { View: unknown }).View;
          }
          return createHostComponent(React, name.replace(/^ViewManagerAdapter_/, "") || "ExpoView");
        },
      };
    };

    mockBoth("expo-modules-core", factory, cwd);

    // Match babel-preset-expo / jest-expo: EXPO_OS drives native vs web branches.
    if (!process.env.EXPO_OS) {
      process.env.EXPO_OS = config.platform;
    }

    // Optional expo package stubs that jest-expo also mocks.
    // preload sets `window=globalThis`, which makes expo's async-require `setup.ts`
    // load HMR — under native EXPO_OS that calls `HMRClient.setup({isEnabled})` and throws.
    if (packageResolves("expo", cwd)) {
      const hmrStub = {
        setup: bunFn(),
        log: bunFn(),
        enable: bunFn(),
        disable: bunFn(),
        registerBundle: bunFn(),
        default: {
          setup: bunFn(),
          log: bunFn(),
          enable: bunFn(),
          disable: bunFn(),
          registerBundle: bunFn(),
        },
      };
      for (const id of [
        "expo/src/async-require/messageSocket",
        "expo/src/async-require/setupHMR",
        "expo/src/async-require/setup",
        "expo/src/async-require/hmr",
        "expo/src/async-require/setupFastRefresh",
      ]) {
        try {
          mockBoth(id, () => (id.endsWith("/hmr") ? hmrStub : {}), cwd);
        } catch {
          // ignore
        }
      }
      try {
        mockBoth("expo/src/winter/FormData", () => ({ installFormDataPatch: bunFn() }), cwd);
      } catch {
        // ignore
      }
    }

    // Minimal `expo` surface if Expo.fx blows up under Bun — only when needed.
    // Prefer real package; consumers import specific expo-* packages.
    if (config.debug) {
      console.log(
        `[rn-bun] expo core shim: ${Object.keys(tables).length} table modules, ${packageMocks.size} package mocks`,
      );
    }

    // Touch app.json for constants consumers later
    void readFileSync;
    void join;
  },
};
