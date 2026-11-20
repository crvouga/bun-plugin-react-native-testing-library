/**
 * Side-effectful preload entry for `bunfig.toml`:
 *
 *   [test]
 *   preload = ["bun-plugin-react-native-testing-library/preload"]
 *
 * Sets RN/Jest globals, registers the Bun plugin, and installs native mocks.
 */

import { plugin } from "bun";
import { createReactNativePlugin } from "./index.ts";
import { loadConfig } from "./config.ts";
import { installJestShims } from "./jest-shims.ts";
import { LIBRARY_REGISTRY, registerLibraryMocks } from "./libraries/index.ts";
import { registerMocks } from "./mocks/index.ts";
import { registerRntlMatchers, registerRntlScreenFix } from "./rntl.ts";
import { collectCompatSources, readConsumerPackageJson } from "./compat-packages.ts";
import { scanUnresolvedEcosystemImports } from "./diagnostics.ts";
const g = globalThis as typeof globalThis & Record<string, unknown>;

// --- React / RN test environment globals ---
g.__DEV__ = true;
g.IS_REACT_ACT_ENVIRONMENT = true;
g.IS_REACT_NATIVE_TEST_ENVIRONMENT = true;
g.nativeFabricUIManager = g.nativeFabricUIManager ?? {};

// RN normally installs this; Expo.fx and LogBox probe it.
if (typeof g.ErrorUtils === "undefined") {
  const defaultHandler = (error: unknown, _isFatal?: boolean) => {
    console.error(error);
  };
  let handler = defaultHandler;
  g.ErrorUtils = {
    setGlobalHandler: (next: typeof defaultHandler) => {
      handler = next;
    },
    getGlobalHandler: () => handler,
    reportError: (error: unknown) => {
      handler(error, false);
    },
    reportFatalError: (error: unknown) => {
      handler(error, true);
    },
  };
}

// babel-preset-expo normally inlines this; set early for Expo packages under Bun.
if (!process.env.EXPO_OS) {
  process.env.EXPO_OS = process.env.RN_BUN_PLATFORM === "android" ? "android" : "ios";
}

if (typeof g.window === "undefined") {
  g.window = globalThis;
}

const win = g.window as Record<string, unknown>;
if (typeof win.history === "undefined") {
  win.history = {
    state: null,
    pushState: () => {},
    replaceState: () => {},
    go: () => {},
    back: () => {},
    forward: () => {},
    length: 1,
  };
}
if (typeof win.addEventListener !== "function") {
  win.addEventListener = () => {};
  win.removeEventListener = () => {};
}
if (typeof win.dispatchEvent !== "function") {
  win.dispatchEvent = () => true;
}

// Minimal DOM stubs some libraries (react-navigation linking) probe in tests.
if (typeof g.document === "undefined") {
  g.document = {
    createElement: () => ({ style: {}, setAttribute: () => {}, appendChild: () => {} }),
    addEventListener: () => {},
    removeEventListener: () => {},
    body: { appendChild: () => {}, removeChild: () => {} },
    documentElement: { style: {} },
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
  };
}
if (typeof g.location === "undefined") {
  g.location = {
    href: "http://localhost/",
    pathname: "/",
    search: "",
    hash: "",
  };
}
if (typeof win.location === "undefined") {
  win.location = g.location;
}

if (typeof g.requestAnimationFrame !== "function") {
  // Return type is annotated and cast because the global setTimeout overload
  // that TS picks depends on file-inclusion order (bun-types vs @types/node
  // both declare globals); the runtime value is a number id.
  g.requestAnimationFrame = (cb: (time: number) => void): number =>
    setTimeout(() => cb(Date.now()), 0) as unknown as number;
}
if (typeof g.cancelAnimationFrame !== "function") {
  g.cancelAnimationFrame = (id: number | null | undefined) => {
    if (id != null) clearTimeout(id);
  };
}

if (typeof g.performance === "undefined") {
  g.performance = { now: () => Date.now() } as unknown as Performance;
} else if (typeof (g.performance as { now?: unknown }).now !== "function") {
  (g.performance as { now: () => number }).now = () => Date.now();
}

installJestShims();

// --- Config + mocks + plugin ---
// IMPORTANT: register mock.module() BEFORE plugin(). On Bun 1.4.0, installing
// the runtime plugin first lets onResolve intercept `react-native` paths and
// bypass subsequent mock.module registrations (real Flow sources then crash).
const config = loadConfig();

const strategy = config.strategy === "auto" ? "namespace" : config.strategy;

registerMocks(config);
const compatSources = collectCompatSources(config.compat.compatPackages, process.cwd());
for (const err of compatSources.errors) {
  // Misconfigured compat packages must be visible, never silent.
  console.warn(err);
}
const result = registerLibraryMocks(config, {
  localShims: config.compat.localShims,
  packageShims: compatSources.packageShims,
});

// Fail-closed guidance for ecosystem imports the suite will not resolve:
// Bun reports the native "Cannot find package" error; the scan prints the
// structured fix (existing shim, scaffold command) beside it. Skipped inside
// this repo's own dev suite, whose tests intentionally reference packages
// that cannot resolve.
const selfRepo = readConsumerPackageJson(process.cwd()).name === "bun-plugin-react-native-testing-library";
if (!selfRepo) {
  // Shims the plan filtered out or disabled were held back on purpose — those
  // matter for guidance. (Registration failures stay out of this message.)
  const heldBack = new Set([...result.disabled, ...result.filteredOut]);
  const disabledShims = LIBRARY_REGISTRY.filter(
    (s) => heldBack.has(s.name) && !result.unavailable.includes(s.name),
  ).map((s) => ({ name: s.name, packages: s.packages, targets: s.targets }));
  for (const warning of scanUnresolvedEcosystemImports(process.cwd(), disabledShims)) {
    console.warn(warning);
  }
}
registerRntlScreenFix();

plugin(
  createReactNativePlugin({
    ...config,
    strategy,
  }),
);

registerRntlMatchers(config.debug);

export { config, strategy };
