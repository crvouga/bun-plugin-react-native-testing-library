/**
 * Shared helpers for library shims.
 */

import { mock } from "bun:test";
import type { ResolvedConfig } from "../config.ts";

export type ShimProvenance = "builtin" | "package" | "local";

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
  /**
   * Mock-target specifiers this shim claims, for registry conflict detection.
   * Omitted on built-in shims: they are gap-fillers that claim nothing.
   * On package/local shims it defaults to their activation `packages`.
   */
  targets?: readonly string[];
  /** Registration priority among built-ins (lower registers earlier). Default 100. */
  priority?: number;
  /** Where this shim came from. Default "builtin". */
  provenance?: ShimProvenance;
  /** Replace an earlier active shim claiming the same target instead of erroring. */
  override?: boolean;
  /** Mock fidelity label. Default "behavioral". "presentation" shims render only. */
  surface?: "behavioral" | "presentation";
};

/**
 * Specifiers this shim claims for conflict detection. Built-ins without an
 * explicit `targets` list are gap-fillers and claim nothing; package and local
 * shims fall back to their activation packages so user-authored shims are
 * protected against silent double-claiming.
 */
export function effectiveTargets(shim: LibraryShim): readonly string[] {
  if (shim.targets) return shim.targets;
  const provenance = shim.provenance ?? "builtin";
  return provenance === "builtin" ? [] : shim.packages;
}

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
