/**
 * RNTL integration helpers.
 *
 * Note: We intentionally do NOT `mock.module("@testing-library/react-native")`.
 * Bun's ESM named-export linker does not reliably pick up CJS spreads from
 * mock factories (breaks `import { render, fireEvent }`). Instead:
 * - Matchers are registered via expect.extend
 * - Live `screen` is available via `getScreen()` / `./screen` export
 * - Consumers can also use the `screen` returned by `render()`
 */

import { expect } from "bun:test";

/** Best-effort matcher registration (also happens when RNTL is imported). */
export function registerRntlMatchers(debug = false): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const matchers = require("@testing-library/react-native/matchers") as Record<string, unknown>;
    expect.extend(matchers as Parameters<typeof expect.extend>[0]);
  } catch (err) {
    if (debug) {
      console.warn("[rn-bun] Could not auto-register RNTL matchers:", err instanceof Error ? err.message : err);
    }
  }
}

/**
 * @deprecated No-op kept for API stability. Full-module screen Proxy broke
 * Bun ESM named exports; use getScreen() from `./screen` or render()'s screen.
 */
export function registerRntlScreenFix(): void {
  // intentionally empty — see file header
}

/** Matcher names shipped by RNTL 14 (file stem without extension). */
export const RNTL_MATCHER_NAMES = [
  "toBeBusy",
  "toBeChecked",
  "toBeCollapsed",
  "toBeDisabled",
  "toBeEmptyElement",
  "toBeEnabled",
  "toBeExpanded",
  "toBeOnTheScreen",
  "toBePartiallyChecked",
  "toBeSelected",
  "toBeVisible",
  "toContainElement",
  "toHaveAccessibilityValue",
  "toHaveAccessibleName",
  "toHaveDisplayValue",
  "toHaveProp",
  "toHaveStyle",
  "toHaveTextContent",
] as const;
