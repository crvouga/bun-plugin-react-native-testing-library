/**
 * Jest globals shim for Bun's test runner.
 * Fills gaps RNTL / library mocks probe (`advanceTimersByTimeAsync`, etc.).
 */

import path from "node:path";

type JestLike = Record<string, unknown>;

let warnedJestMock = false;

/**
 * Best-effort caller-file resolution for requireActual's relative ids:
 * the first stack frame outside this shim.
 */
function resolveCallerFile(): string | null {
  const stack = new Error().stack?.split("\n") ?? [];
  for (const line of stack) {
    const match = /((?:\/[^\s():]+)+\.(?:ts|tsx|js|jsx|mjs|cjs)):\d+:\d+/.exec(line);
    if (match?.[1] && !match[1].endsWith("jest-shims.ts")) {
      return match[1];
    }
  }
  return null;
}

export function installJestShims(): void {
  const g = globalThis as typeof globalThis & { jest?: JestLike };
  const targets: JestLike[] = [];

  if (g.jest && typeof g.jest === "object") targets.push(g.jest);
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const bunTest = require("bun:test") as { jest?: JestLike };
    if (bunTest.jest && typeof bunTest.jest === "object") targets.push(bunTest.jest);
  } catch {
    // ignore
  }

  if (targets.length === 0) {
    g.jest = {};
    targets.push(g.jest);
  }

  for (const existing of targets) {
    patchJest(existing);
  }
  g.jest = targets[0]!;
}

function patchJest(existing: JestLike): void {
  if (typeof existing.fn !== "function") {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { mock } = require("bun:test") as { mock: (...args: unknown[]) => unknown };
      existing.fn = (...args: unknown[]) => mock(...args);
    } catch {
      existing.fn = (impl?: (...a: unknown[]) => unknown) => {
        const f = (...a: unknown[]) => (impl ? impl(...a) : undefined);
        (f as { _isMockFunction?: boolean })._isMockFunction = true;
        return f;
      };
    }
  }

  if (typeof existing.setSystemTime !== "function") {
    existing.setSystemTime = (now: number | Date) => {
      const ms = typeof now === "number" ? now : now.getTime();
      // Best-effort: Bun may not support clock mocking; keep a no-op-safe stub.
      try {
        const enableFakeTimers = existing.useFakeTimers as (() => void) | undefined;
        enableFakeTimers?.();
        void ms;
      } catch {
        // ignore
      }
    };
  }

  if (typeof existing.getRealSystemTime !== "function") {
    existing.getRealSystemTime = () => Date.now();
  }
  if (typeof existing.now !== "function") {
    existing.now = () => Date.now();
  }

  if (typeof existing.advanceTimersByTimeAsync !== "function") {
    existing.advanceTimersByTimeAsync = async (ms: number) => {
      const fn = existing.advanceTimersByTime as ((n: number) => void) | undefined;
      fn?.(ms);
    };
  }
  if (typeof existing.runAllTimersAsync !== "function") {
    existing.runAllTimersAsync = async () => {
      const fn = existing.runAllTimers as (() => void) | undefined;
      fn?.();
    };
  }
  if (typeof existing.runOnlyPendingTimersAsync !== "function") {
    existing.runOnlyPendingTimersAsync = async () => {
      const fn = existing.runOnlyPendingTimers as (() => void) | undefined;
      fn?.();
    };
  }

  if (typeof existing.requireActual !== "function") {
    existing.requireActual = (id: string) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        return require(id);
      } catch (err) {
        // Jest resolves relative ids against the CALLING file; a plain require
        // would resolve against this shim. Re-resolve from the caller.
        if (id.startsWith(".")) {
          const caller = resolveCallerFile();
          if (caller) {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            return require(path.resolve(path.dirname(caller), id));
          }
        }
        throw err;
      }
    };
  }
  if (typeof existing.requireMock !== "function") {
    existing.requireMock = (id: string) => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require(id);
    };
  }
  if (typeof existing.isMockFunction !== "function") {
    existing.isMockFunction = (fn: unknown) =>
      Boolean(fn && typeof fn === "function" && (fn as { _isMockFunction?: boolean })._isMockFunction);
  }

  if (typeof existing.mock !== "function") {
    existing.mock = (..._args: unknown[]) => {
      if (!warnedJestMock) {
        warnedJestMock = true;
        console.warn(
          "[rn-bun] jest.mock() is not supported under bun test. Use mock.module() from bun:test, or rely on bun-plugin-react-native-testing-library libraryMocks.",
        );
      }
    };
  } else {
    // Native jest.mock requires a factory and throws a bare TypeError for a
    // missing one. Keep the factory path native (it maps to mock.module),
    // and make the factory-less failure carry the migration pointer.
    const nativeMock = existing.mock as (id: string, factory?: () => unknown) => void;
    existing.mock = (id: string, factory?: () => unknown) => {
      if (typeof factory !== "function") {
        throw new Error(
          `[rn-bun] jest.mock('${id}') without a factory is not supported. ` +
            `Use jest.mock('${id}', () => ({ ... })) or mock.module('${id}', factory) from bun:test — ` +
            `see docs/migration-jest.md.`,
        );
      }
      return nativeMock(id, factory);
    };
  }

  if (typeof existing.resetModules !== "function") {
    existing.resetModules = () => {
      throw new Error(
        "[rn-bun] jest.resetModules() has no bun:test equivalent (module registry is not resettable). " +
          "Isolate state by splitting tests into separate files, or re-register with mock.module — " +
          "see docs/migration-jest.md.",
      );
    };
  }
}
