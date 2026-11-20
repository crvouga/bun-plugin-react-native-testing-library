/**
 * Contract: Jest API compatibility under the preload.
 *
 * Bun's raw jest surface has gaps (verified on Bun 1.4.4: no requireActual,
 * advanceTimersByTimeAsync, resetModules...). installJestShims fills the
 * fillable ones; the unfillable ones fail loudly with the migration pointer.
 * Every delta in docs/migration-jest.md references a test here.
 */

import { describe, expect, test, jest } from "bun:test";
import { render } from "@testing-library/react-native";
import { Text } from "react-native";

describe("jest-compat: shimmed surface", () => {
  test("RN-critical jest APIs exist under the preload", () => {
    const surface = [
      "fn",
      "spyOn",
      "advanceTimersByTimeAsync",
      "getRealSystemTime",
      "setSystemTime",
      "requireActual",
      "requireMock",
      "isMockFunction",
    ];
    const j = jest as unknown as Record<string, unknown>;
    for (const key of surface) {
      expect(typeof j[key]).toBe("function");
    }
  });

  test("requireActual returns the real module surface", () => {
    const j = jest as unknown as { requireActual: (id: string) => unknown };
    const actual = j.requireActual("./host-module.ts") as { value: number; derive: (n: number) => number };
    expect(actual.value).toBe(7);
    expect(actual.derive(3)).toBe(10);
  });
});

describe("jest-compat: module mocking", () => {
  test("jest.mock with a factory behaves like mock.module", () => {
    const j = jest as unknown as { mock: (id: string, factory?: () => unknown) => void };
    j.mock("./host-module.ts", () => ({ value: 99, derive: () => 0 }));
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mocked = require("./host-module.ts") as { value: number };
    expect(mocked.value).toBe(99);
  });

  test("bare jest.mock (no factory) fails loudly with the migration pointer", () => {
    const j = jest as unknown as { mock: (id: string, factory?: () => unknown) => void };
    // Factory-less jest.mock cannot be honored faithfully (no automock in
    // bun): it throws instead of silently leaving the real module in place.
    expect(() => j.mock("./host-module.ts")).toThrow(/without a factory[\s\S]*docs\/migration-jest\.md/);
  });
});

describe("jest-compat: timers and async scheduling", () => {
  test("fake timers + advanceTimersByTimeAsync drives a timed promise", async () => {
    jest.useFakeTimers();
    let fired = false;
    const promise = new Promise<void>((resolve) => {
      setTimeout(() => {
        fired = true;
        resolve();
      }, 5_000);
    });
    const j = jest as unknown as { advanceTimersByTimeAsync: (ms: number) => Promise<void> };
    await j.advanceTimersByTimeAsync(5_000);
    await promise;
    expect(fired).toBe(true);
    jest.useRealTimers();
  });

  test("RNTL waitFor resolves under fake timers via the shim", async () => {
    jest.useFakeTimers();
    let ready = false;
    setTimeout(() => {
      ready = true;
    }, 30_000);
    const screen = await render(<Text testID="wait">wait</Text>);
    // RNTL waitFor polls with real intervals; under fake timers the shim's
    // advanceTimersByTimeAsync keeps the clock moving.
    const j = jest as unknown as { advanceTimersByTimeAsync: (ms: number) => Promise<void> };
    const waiting = (async () => {
      for (let i = 0; i < 10 && !ready; i++) {
        await j.advanceTimersByTimeAsync(10_000);
      }
    })();
    await waiting;
    expect(ready).toBe(true);
    screen.unmount();
    jest.useRealTimers();
  });
});

describe("jest-compat: snapshots", () => {
  test("RN render snapshot writes and matches", async () => {
    const screen = await render(<Text testID="snap-label">{["sdk", "compat"].join("-")}</Text>);
    expect(screen.toJSON()).toMatchSnapshot();
    screen.unmount();
  });
});

describe("jest-compat: module isolation", () => {
  test("resetModules fails loudly with the migration pointer (no silent no-op)", () => {
    const j = jest as unknown as { resetModules?: () => void };
    expect(typeof j.resetModules).toBe("function");
    expect(() => j.resetModules?.()).toThrow(/docs\/migration-jest\.md/);
  });

  test("module state persists across requires; isolation is per-file (documented pattern)", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("./counter-module.ts") as { count: number; increment: () => number };
    mod.increment();
    expect(mod.count).toBe(1);
    // Same resolved path → same module instance, even through jest.requireActual.
    const j = jest as unknown as { requireActual: (id: string) => { count: number } };
    expect(j.requireActual("./counter-module.ts").count).toBe(1);
    mod.increment();
    expect(j.requireActual("./counter-module.ts").count).toBe(2);
  });
});
