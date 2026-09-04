/**
 * Side-effectful preload entry for `bunfig.toml`:
 *
 *   [test]
 *   preload = ["bun-plugin-react-native-testing-library/preload"]
 *
 * Sets RN/Jest globals, registers the Bun plugin, and installs native mocks.
 */

import { plugin } from "bun";
import { expect } from "bun:test";
import { createReactNativePlugin } from "./index.ts";
import { loadConfig } from "./config.ts";
import { registerMocks } from "./mocks/index.ts";

const g = globalThis as typeof globalThis & Record<string, unknown>;

// --- React / RN test environment globals ---
g.__DEV__ = true;
g.IS_REACT_ACT_ENVIRONMENT = true;
g.IS_REACT_NATIVE_TEST_ENVIRONMENT = true;
g.nativeFabricUIManager = g.nativeFabricUIManager ?? {};

if (typeof g.window === "undefined") {
  g.window = globalThis;
}

if (typeof g.requestAnimationFrame !== "function") {
  g.requestAnimationFrame = (cb: (time: number) => void): ReturnType<typeof setTimeout> =>
    setTimeout(() => cb(Date.now()), 0);
}
if (typeof g.cancelAnimationFrame !== "function") {
  g.cancelAnimationFrame = (id: ReturnType<typeof setTimeout>): void => {
    clearTimeout(id);
  };
}

if (typeof g.performance === "undefined") {
  g.performance = { now: () => Date.now() };
} else if (typeof (g.performance as { now?: unknown }).now !== "function") {
  (g.performance as { now: () => number }).now = () => Date.now();
}

// --- Minimal jest shim for RNTL timer probes (bun:test already exposes `jest`) ---
// RNTL's helpers/timers.js checks `typeof jest !== 'undefined'` and
// `setTimeout._isMockFunction` / `jest.getRealSystemTime`. bun:test's jest
// covers useFakeTimers / useRealTimers / advanceTimersByTime*; fill gaps.
type JestLike = Record<string, unknown>;
const existingJest = (g.jest ?? {}) as JestLike;
if (typeof existingJest.getRealSystemTime !== "function") {
  existingJest.getRealSystemTime = () => Date.now();
}
if (typeof existingJest.now !== "function") {
  existingJest.now = () => Date.now();
}
g.jest = existingJest;

// --- Config + mocks + plugin ---
// IMPORTANT: register mock.module() BEFORE plugin(). On Bun 1.4.0, installing
// the runtime plugin first lets onResolve intercept `react-native` paths and
// bypass subsequent mock.module registrations (real Flow sources then crash).
const config = loadConfig();

const strategy = config.strategy === "auto" ? "namespace" : config.strategy;

registerMocks(config);

plugin(
  createReactNativePlugin({
    ...config,
    strategy,
  }),
);

// --- Matcher fallback ---
// RNTL's main entry calls `expect.extend(...)` via `./matchers/extend-expect`.
// Registering matchers here is best-effort: requiring the RNTL package at
// preload time can re-enter beforeAll in some Bun layouts, so we swallow errors.
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const matchers = require("@testing-library/react-native/matchers") as Record<
    string,
    unknown
  >;
  expect.extend(matchers as Parameters<typeof expect.extend>[0]);
} catch (err) {
  if (config.debug) {
    console.warn(
      "[rn-bun] Could not auto-register RNTL matchers (they still register when you import RNTL):",
      err instanceof Error ? err.message : err,
    );
  }
}

export { config, strategy };
