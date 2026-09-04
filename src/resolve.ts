/**
 * Metro-style platform extension resolution — pure and unit-testable.
 *
 * Priority (for platform = "ios"):
 *   Foo.ios.js → Foo.native.js → Foo.js
 *   (same for .jsx / .ts / .tsx / .json, then index.*)
 */

import path from "node:path";

export type Platform = "ios" | "android";

export type ExistsFn = (absPath: string) => boolean;

const SOURCE_EXTS = [".js", ".jsx", ".ts", ".tsx", ".json"] as const;

/**
 * Build the ordered list of candidate absolute paths for a bare specifier
 * relative to `importerDir`, without checking existence.
 */
export function candidatePaths(specifier: string, importerDir: string, platform: Platform): string[] {
  // Only relative imports participate in platform resolution.
  if (!(specifier.startsWith("./") || specifier.startsWith("../") || path.isAbsolute(specifier))) {
    return [];
  }

  const abs = path.isAbsolute(specifier) ? specifier : path.resolve(importerDir, specifier);
  const { dir, name, ext } = splitPath(abs);

  // If the specifier already has a platform/native suffix or a known source
  // extension, try that exact path first, then fall through to platform variants
  // of the base name.
  const bases: string[] = [];
  if (ext && SOURCE_EXTS.includes(ext as (typeof SOURCE_EXTS)[number])) {
    // Specifier already includes an extension — try exact, then re-resolve base.
    bases.push(path.join(dir, name));
  } else if (ext && (ext === `.${platform}` || ext === ".native")) {
    // Unusual: Foo.ios with no further ext — treat name+ext as base stem.
    bases.push(abs);
  } else {
    bases.push(abs);
  }

  const out: string[] = [];
  const seen = new Set<string>();
  const push = (p: string) => {
    if (!seen.has(p)) {
      seen.add(p);
      out.push(p);
    }
  };

  for (const base of bases) {
    for (const platformSuffix of [`${base}.${platform}`, `${base}.native`, base]) {
      for (const e of SOURCE_EXTS) {
        push(platformSuffix + e);
      }
    }
    // Directory / index resolution
    for (const platformSuffix of [
      path.join(base, `index.${platform}`),
      path.join(base, "index.native"),
      path.join(base, "index"),
    ]) {
      for (const e of SOURCE_EXTS) {
        push(platformSuffix + e);
      }
    }
  }

  return out;
}

function splitPath(abs: string): { dir: string; name: string; ext: string } {
  const dir = path.dirname(abs);
  const base = path.basename(abs);
  const dot = base.lastIndexOf(".");
  if (dot <= 0) {
    return { dir, name: base, ext: "" };
  }
  // Don't treat `.native` / `.ios` / `.android` as the sole extension when
  // there's another ext after — e.g. Foo.ios.js → name=Foo.ios, ext=.js
  const known = SOURCE_EXTS.find((e) => base.endsWith(e));
  if (known) {
    return { dir, name: base.slice(0, -known.length), ext: known };
  }
  return { dir, name: base.slice(0, dot), ext: base.slice(dot) };
}

/**
 * Resolve a relative specifier to the highest-priority existing file.
 * Returns `null` if nothing matches.
 */
export function resolvePlatformFile(
  specifier: string,
  importerDir: string,
  platform: Platform,
  exists: ExistsFn,
): string | null {
  const candidates = candidatePaths(specifier, importerDir, platform);
  for (const c of candidates) {
    if (exists(c)) return c;
  }
  return null;
}

/**
 * Given a virtual file map (keys = absolute paths that "exist"), resolve.
 * Convenience for property / unit tests.
 */
export function resolveAgainstMap(
  specifier: string,
  importerDir: string,
  platform: Platform,
  fileMap: ReadonlySet<string> | ReadonlyMap<string, unknown>,
): string | null {
  const exists = fileMap instanceof Set ? (p: string) => fileMap.has(p) : (p: string) => fileMap.has(p);
  return resolvePlatformFile(specifier, importerDir, platform, exists);
}

/**
 * Priority rank of a resolved path relative to a base name (lower = better).
 * Used by property tests to assert "highest priority existing variant".
 *
 * Order: `.${platform}` → `.native` → `` (plain) ; within each, SOURCE_EXTS order.
 */
export function priorityRank(resolvedPath: string, baseAbs: string, platform: Platform): number {
  const ranked = candidatePaths(
    path.isAbsolute(baseAbs) ? baseAbs : `./${path.basename(baseAbs)}`,
    path.dirname(baseAbs),
    platform,
  );
  const idx = ranked.indexOf(resolvedPath);
  return idx < 0 ? Number.POSITIVE_INFINITY : idx;
}

/**
 * Deliberately broken resolver that skips `.native` variants.
 * Used by the meta-test to prove fast-check shrinks to a minimal counterexample.
 */
export function brokenResolveSkipNative(
  specifier: string,
  importerDir: string,
  platform: Platform,
  exists: ExistsFn,
): string | null {
  const candidates = candidatePaths(specifier, importerDir, platform).filter((c) => !c.includes(".native."));
  for (const c of candidates) {
    if (exists(c)) return c;
  }
  return null;
}
