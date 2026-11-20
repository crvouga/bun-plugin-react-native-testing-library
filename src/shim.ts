/**
 * Public shim definition API.
 *
 * `defineShim` validates a compatibility shim and returns it unchanged, so a
 * consumer config file or npm shim package can declare project-specific
 * library support without touching this package's internals.
 */

import type { LibraryShim } from "./libraries/helpers.ts";

function isArrayOfStrings(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

/**
 * Validate and return a library shim for use in `rn-bun.config.ts` (`compat.shims`)
 * or in an npm compat package's exported shim list.
 *
 * Throws a descriptive error when the shape is wrong, so a broken shim is a
 * named problem at load time rather than a mystery at registration time.
 */
export function defineShim(shim: LibraryShim): LibraryShim {
  const label = typeof shim?.name === "string" && shim.name !== "" ? `"${shim.name}"` : "(unnamed shim)";
  const fail = (reason: string): never => {
    throw new Error(`[rn-bun] Invalid shim ${label}: ${reason}`);
  };

  if (shim == null || typeof shim !== "object") {
    throw new Error(`[rn-bun] Invalid shim: expected an object, got ${shim === null ? "null" : typeof shim}`);
  }
  if (typeof shim.name !== "string" || shim.name === "") fail("name must be a non-empty string");
  if (!isArrayOfStrings(shim.packages) || shim.packages.length === 0) {
    fail("packages must be a non-empty array of package names");
  }
  if (typeof shim.register !== "function") fail("register must be a function");
  if (shim.targets !== undefined && !isArrayOfStrings(shim.targets)) fail("targets must be an array of specifiers");
  if (shim.provenance === "builtin") fail(`provenance "builtin" is reserved for built-in shims`);
  if (shim.provenance !== undefined && shim.provenance !== "local" && shim.provenance !== "package") {
    fail(`provenance must be "local" or "package"`);
  }
  if (shim.override !== undefined && typeof shim.override !== "boolean") fail("override must be a boolean");
  if (shim.surface !== undefined && shim.surface !== "behavioral" && shim.surface !== "presentation") {
    fail(`surface must be "behavioral" or "presentation"`);
  }
  if (shim.priority !== undefined && (typeof shim.priority !== "number" || !Number.isFinite(shim.priority))) {
    fail("priority must be a finite number");
  }
  return shim;
}
