/**
 * Shared helpers for library shims.
 */

import { mock } from "bun:test";
import type { ResolvedConfig } from "../config.ts";

export type LibraryShimContext = {
  config: ResolvedConfig;
  cwd: string;
};

export type LibraryShim = {
  /** Registry name used by `libraryMocks` filter. */
  name: string;
  /** Packages that must resolve from cwd for this shim to activate. */
  packages: readonly string[];
  register: (ctx: LibraryShimContext) => void | Promise<void>;
};

export function packageResolves(specifier: string, cwd: string): boolean {
  try {
    Bun.resolveSync(specifier, cwd);
    return true;
  } catch {
    return false;
  }
}

export function mockBoth(specifier: string, factory: () => unknown, cwd = process.cwd()): void {
  try {
    mock.module(specifier, factory);
  } catch {
    // ignore
  }
  try {
    const abs = Bun.resolveSync(specifier, cwd);
    mock.module(abs, factory);
  } catch {
    // ignore
  }
}

export function tryRequire(specifier: string, cwd = process.cwd()): unknown | null {
  try {
    const abs = Bun.resolveSync(specifier, cwd);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require(abs);
  } catch {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require(specifier);
    } catch {
      return null;
    }
  }
}

export function loadConsumerReact(): typeof import("react") {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require(Bun.resolveSync("react", process.cwd()));
  } catch {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("react");
  }
}
