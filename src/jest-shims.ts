/**
 * Jest globals shim for Bun's test runner.
 * Fills gaps RNTL / library mocks probe (`advanceTimersByTimeAsync`, etc.).
 */

type JestLike = Record<string, unknown>;

let warnedJestMock = false;

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
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require(id);
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
  }
}
