/**
 * Fail-closed scanners over sandbox node_modules.
 *
 * Discovers react-native deep imports, native surfaces, and platform-entry
 * hazards so new third-party packages cannot silently crash bun:test.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { DEEP_IMPORT_PATTERNS, NATIVE_SURFACE_PATTERNS, SCAN_EXTS, type CatalogEntry } from "./catalog.ts";

/** Directories skipped while walking. dist/build ARE scanned (shipped runtime). */
const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "android",
  "ios",
  "__tests__",
  "tests",
  "test",
  "docs",
  "examples",
  "example",
  "website",
  ".yarn",
  "flow-typed",
  "__flowtests__",
]);

export type ScanIssue = {
  package: string;
  path: string;
  reason: string;
};

export function sandboxNodeModules(sandboxRoot: string): string {
  return path.join(sandboxRoot, "node_modules");
}

export function packageDir(nodeModules: string, name: string): string | null {
  const dir = path.join(nodeModules, ...name.split("/"));
  return existsSync(dir) ? dir : null;
}

function walkFiles(dir: string, out: string[], issues: ScanIssue[], pkgName: string, depth = 0): void {
  if (depth > 16) return;
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch (err) {
    issues.push({ package: pkgName, path: dir, reason: `unreadable directory: ${(err as Error).message}` });
    return;
  }
  for (const name of entries) {
    if (name.startsWith(".")) continue;
    const full = path.join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch (err) {
      issues.push({ package: pkgName, path: full, reason: `unreadable path: ${(err as Error).message}` });
      continue;
    }
    if (st.isDirectory()) {
      if (SKIP_DIRS.has(name)) continue;
      walkFiles(full, out, issues, pkgName, depth + 1);
    } else if (st.isFile()) {
      const ext = path.extname(name);
      if (SCAN_EXTS.has(ext)) out.push(full);
    }
  }
}

function readSource(file: string, pkgName: string, issues: ScanIssue[]): string | null {
  try {
    let src = readFileSync(file, "utf8");
    // Cap per-file cost for huge bundles (still scan the head — fail if truncated region has no newline end)
    if (src.length > 4_000_000) {
      issues.push({
        package: pkgName,
        path: file,
        reason: `runtime source exceeds 4MB scan budget (${src.length} bytes) — split or allowlist explicitly`,
      });
      src = src.slice(0, 4_000_000);
    }
    return src;
  } catch (err) {
    issues.push({ package: pkgName, path: file, reason: `unreadable file: ${(err as Error).message}` });
    return null;
  }
}

/** Collect deep `react-native/Libraries|src/...` specifiers from a package tree. */
export function scanDeepImports(
  pkgRoot: string,
  pkgName = path.basename(pkgRoot),
  issues: ScanIssue[] = [],
): Set<string> {
  const files: string[] = [];
  walkFiles(pkgRoot, files, issues, pkgName);
  const found = new Set<string>();
  for (const file of files) {
    const src = readSource(file, pkgName, issues);
    if (src == null) continue;
    for (const re of DEEP_IMPORT_PATTERNS) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(src)) !== null) {
        const spec = m[1];
        if (spec) found.add(spec.replace(/\.(js|tsx?|mjs|cjs)$/, ""));
      }
    }
  }
  return found;
}

export type DeepImportHit = {
  package: string;
  specifier: string;
};

/** Scan catalog packages for deep RN imports. Throws if node_modules is missing. */
export function collectCatalogDeepImports(
  sandboxRoot: string,
  catalog: readonly CatalogEntry[],
  issues: ScanIssue[] = [],
): DeepImportHit[] {
  const nm = sandboxNodeModules(sandboxRoot);
  if (!existsSync(nm)) {
    throw new Error(`collectCatalogDeepImports: missing node_modules at ${nm} (run scripts/bootstrap-fixtures.ts)`);
  }
  const hits: DeepImportHit[] = [];
  for (const entry of catalog) {
    const dir = packageDir(nm, entry.name);
    if (!dir) {
      issues.push({ package: entry.name, path: nm, reason: "catalog package not installed in sandbox" });
      continue;
    }
    for (const spec of scanDeepImports(dir, entry.name, issues)) {
      hits.push({ package: entry.name, specifier: spec });
    }
  }
  return hits;
}

export type NativeSurfaceHit = {
  package: string;
  kind: "TurboModule" | "NativeModules" | "codegenNativeComponent" | "requireNativeComponent";
  name: string;
  file: string;
};

/** Discover native surfaces that must map to a registry shim. */
export function collectNativeSurfaces(
  sandboxRoot: string,
  catalog: readonly CatalogEntry[],
  issues: ScanIssue[] = [],
): NativeSurfaceHit[] {
  const nm = sandboxNodeModules(sandboxRoot);
  if (!existsSync(nm)) {
    throw new Error(`collectNativeSurfaces: missing node_modules at ${nm}`);
  }
  const hits: NativeSurfaceHit[] = [];
  const kinds: NativeSurfaceHit["kind"][] = [
    "TurboModule",
    "NativeModules",
    "codegenNativeComponent",
    "requireNativeComponent",
  ];

  for (const entry of catalog) {
    const dir = packageDir(nm, entry.name);
    if (!dir) continue;
    const files: string[] = [];
    walkFiles(dir, files, issues, entry.name);
    for (const file of files) {
      const src = readSource(file, entry.name, issues);
      if (src == null) continue;
      NATIVE_SURFACE_PATTERNS.forEach((re, idx) => {
        re.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = re.exec(src)) !== null) {
          const name = m[1];
          if (!name) continue;
          hits.push({ package: entry.name, kind: kinds[idx]!, name, file });
        }
      });
    }
  }
  return hits;
}

export type PlatformHazard = {
  package: string;
  entry: string;
  reason: "platform-ext" | "import-type";
};

/** Detect platform entries / Bun-rejected `import { type }` in catalog packages. */
export function collectPlatformHazards(
  sandboxRoot: string,
  catalog: readonly CatalogEntry[],
  issues: ScanIssue[] = [],
): PlatformHazard[] {
  const nm = sandboxNodeModules(sandboxRoot);
  if (!existsSync(nm)) {
    throw new Error(`collectPlatformHazards: missing node_modules at ${nm}`);
  }
  const hazards: PlatformHazard[] = [];

  for (const entry of catalog) {
    const dir = packageDir(nm, entry.name);
    if (!dir) {
      issues.push({ package: entry.name, path: nm, reason: "catalog package not installed in sandbox" });
      continue;
    }
    let resolved: string | null = null;
    try {
      resolved = Bun.resolveSync(entry.name, sandboxRoot);
    } catch {
      try {
        const pkg = JSON.parse(readFileSync(path.join(dir, "package.json"), "utf8")) as {
          main?: string;
          "react-native"?: string;
          exports?: unknown;
        };
        const main = pkg["react-native"] ?? pkg.main;
        if (main) resolved = path.resolve(dir, main);
      } catch (err) {
        issues.push({
          package: entry.name,
          path: dir,
          reason: `cannot resolve package entry: ${(err as Error).message}`,
        });
        continue;
      }
    }
    if (!resolved || !existsSync(resolved)) {
      issues.push({ package: entry.name, path: dir, reason: "resolved entry missing on disk" });
      continue;
    }

    const base = path.basename(resolved);
    if (/\.(ios|android|native)\.[cm]?[jt]sx?$/.test(base)) {
      hazards.push({ package: entry.name, entry: resolved, reason: "platform-ext" });
    }

    const src = readSource(resolved, entry.name, issues);
    if (src != null && /import\s*\{[^}]*\btype\s+[A-Za-z]/.test(src)) {
      hazards.push({ package: entry.name, entry: resolved, reason: "import-type" });
    }
  }

  return hazards;
}

/** True if require result looks like an empty Module {}. */
export function isEmptyModule(mod: unknown): boolean {
  if (mod == null) return true;
  if (typeof mod !== "object") return false;
  const keys = Object.keys(mod as object).filter((k) => k !== "__esModule" && k !== "default");
  const def = (mod as { default?: unknown }).default;
  if (def != null && typeof def === "object") {
    const dkeys = Object.keys(def as object);
    if (dkeys.length > 0) return false;
  }
  if (typeof def === "function") return false;
  return keys.length === 0 && (def == null || (typeof def === "object" && Object.keys(def as object).length === 0));
}

function isModuleAsValue(mod: unknown): boolean {
  if (mod == null) return false;
  if (typeof mod === "function") return true;
  if (typeof mod === "object" && ("$$typeof" in (mod as object) || "displayName" in (mod as object))) {
    return true;
  }
  return false;
}

export function getExport(mod: unknown, name: string): unknown {
  if (mod == null) return undefined;
  if (typeof mod !== "object" && typeof mod !== "function") return undefined;
  const o = mod as Record<string, unknown>;
  if (name in o) return o[name];
  const d = o.default;
  if (d != null && typeof d === "object" && name in (d as object)) {
    return (d as Record<string, unknown>)[name];
  }
  if (typeof d === "function" && name === "default") return d;
  if (name === "default") {
    if (d !== undefined) return d;
    if (isModuleAsValue(mod)) return mod;
    return mod;
  }
  if (
    isModuleAsValue(mod) &&
    (name === "FlashList" || name === "Picker" || name === "WebView" || name === "BottomSheet" || name === "Svg")
  ) {
    return mod;
  }
  return undefined;
}

/** Direct dependency names from a sandbox package.json (dependencies + peerDependencies). */
export function readDirectDependencies(sandboxRoot: string): Set<string> {
  const pkgPath = path.join(sandboxRoot, "package.json");
  if (!existsSync(pkgPath)) {
    throw new Error(`readDirectDependencies: missing ${pkgPath}`);
  }
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
    dependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  return new Set([
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.peerDependencies ?? {}),
    // sandbox test tooling lives in devDependencies but product packages under test do not
  ]);
}
