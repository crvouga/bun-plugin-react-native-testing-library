/**
 * npm-distributed compatibility shim packages.
 *
 * Discovery: a consumer dependency named `bun-rn-compat-*` (documented
 * convention) is loaded automatically; explicit `compat.compatPackages`
 * entries work for packages outside the convention and come first.
 *
 * Loading: each package must expose its shims via a `./shim` export (or the
 * package root), as an array of shim objects. A package that resolves but
 * does not export shims is a reported error — never a silent skip.
 */

import { readFileSync } from "node:fs";
import type { LibraryShim } from "./libraries/helpers.ts";
import { tryRequire } from "./libraries/helpers.ts";
import { defineShim } from "./shim.ts";

export const COMPAT_PACKAGE_PATTERN = /^bun-rn-compat-/;

export type CompatPackageLoad = {
  name: string;
  shims: LibraryShim[];
  errors: string[];
};

/**
 * Read the consumer's package.json. Returns an empty object when absent or
 * unreadable, so callers fall back to explicit configuration only.
 */
export function readConsumerPackageJson(cwd: string): {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
} {
  try {
    return JSON.parse(readFileSync(`${cwd}/package.json`, "utf8"));
  } catch {
    return {};
  }
}

/**
 * Package names to load: explicit entries first, then `bun-rn-compat-*`
 * dependencies and devDependencies from the consumer's package.json.
 */
export function discoverCompatPackages(cwd: string, explicit: readonly string[] = []): string[] {
  const found = new Set<string>();
  for (const name of explicit) {
    if (typeof name === "string" && name !== "") found.add(name);
  }
  const pkg = readConsumerPackageJson(cwd);
  for (const section of [pkg.dependencies, pkg.devDependencies]) {
    for (const name of Object.keys(section ?? {})) {
      if (COMPAT_PACKAGE_PATTERN.test(name)) found.add(name);
    }
  }
  return [...found];
}

/** Load and validate the shims one compat package exports. */
export function loadCompatPackageShims(name: string, cwd: string): CompatPackageLoad {
  // `<pkg>/shim` is the documented export; the package root is the fallback.
  const mod = tryRequire(`${name}/shim`, cwd) ?? tryRequire(name, cwd);
  if (mod == null) {
    return {
      name,
      shims: [],
      errors: [
        `[rn-bun] compat package "${name}" is installed but exports no ./shim module (expected \`exports["./shim"]\` exporting an array of shims)`,
      ],
    };
  }

  const raw = (mod as { shims?: unknown; default?: unknown }).shims ?? (mod as { default?: unknown }).default ?? mod;
  const candidates = Array.isArray(raw) ? raw : [];
  const shims: LibraryShim[] = [];
  const errors: string[] = [];
  for (const candidate of candidates) {
    try {
      shims.push(defineShim(candidate as LibraryShim));
    } catch (err) {
      errors.push(`[rn-bun] compat package "${name}": ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  if (!Array.isArray(raw)) {
    errors.push(`[rn-bun] compat package "${name}" did not export an array of shims`);
  }
  return { name, shims, errors };
}

/**
 * Collect the registry sources implied by the consumer's compat configuration
 * and package.json: project-local shims plus npm compat package shims.
 * Shared by the preload entry and `registerCompat` so both paths behave alike.
 */
export function collectCompatSources(
  compatPackages: readonly string[],
  cwd: string,
): {
  packageShims: LibraryShim[];
  packages: { name: string; loaded: boolean; shims: string[]; errors: string[] }[];
  errors: string[];
} {
  const names = discoverCompatPackages(cwd, compatPackages);
  const packageShims: LibraryShim[] = [];
  const packages: { name: string; loaded: boolean; shims: string[]; errors: string[] }[] = [];
  const errors: string[] = [];
  for (const name of names) {
    const loaded = loadCompatPackageShims(name, cwd);
    packageShims.push(...loaded.shims);
    packages.push({
      name: loaded.name,
      loaded: loaded.errors.length === 0,
      shims: loaded.shims.map((s) => s.name),
      errors: loaded.errors,
    });
    errors.push(...loaded.errors);
  }
  return { packageShims, packages, errors };
}
