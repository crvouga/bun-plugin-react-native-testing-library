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
import { registerLibraryMocks } from "./libraries/index.ts";
import { registerMocks } from "./mocks/index.ts";
import { registerRntlMatchers, registerRntlScreenFix } from "./rntl.ts";

const g = globalThis as typeof globalThis & Record<string, unknown>;

// --- React / RN test environment globals ---
g.__DEV__ = true;
g.IS_REACT_ACT_ENVIRONMENT = true;
g.IS_REACT_NATIVE_TEST_ENVIRONMENT = true;
g.nativeFabricUIManager = g.nativeFabricUIManager ?? {};

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
  g.requestAnimationFrame = (cb: (time: number) => void) => setTimeout(() => cb(Date.now()), 0);
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
registerLibraryMocks(config);
registerRntlScreenFix();

plugin(
  createReactNativePlugin({
    ...config,
    strategy,
  }),
);

registerRntlMatchers(config.debug);

export { config, strategy };
