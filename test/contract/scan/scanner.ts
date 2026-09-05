/**
 * Fail-closed scanners over sandbox node_modules.
 *
 * Discovers react-native deep imports and platform-entry hazards so new
 * third-party packages cannot silently crash bun:test.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { DEEP_IMPORT_PATTERNS, SCAN_EXTS, type CatalogEntry } from "./catalog.ts";

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
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
]);

export function sandboxNodeModules(sandboxRoot: string): string {
  return path.join(sandboxRoot, "node_modules");
}

export function packageDir(nodeModules: string, name: string): string | null {
  const dir = path.join(nodeModules, ...name.split("/"));
  return existsSync(dir) ? dir : null;
}

function walkFiles(dir: string, out: string[], depth = 0): void {
  if (depth > 12) return;
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (name.startsWith(".")) continue;
    const full = path.join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      if (SKIP_DIRS.has(name)) continue;
      walkFiles(full, out, depth + 1);
    } else if (st.isFile()) {
      const ext = path.extname(name);
      if (SCAN_EXTS.has(ext)) out.push(full);
    }
  }
}

/** Collect deep `react-native/Libraries|src/...` specifiers from a package tree. */
export function scanDeepImports(pkgRoot: string): Set<string> {
  const files: string[] = [];
  walkFiles(pkgRoot, files);
  const found = new Set<string>();
  for (const file of files) {
    let src: string;
    try {
      src = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    // Cap per-file read cost for huge bundles
    if (src.length > 2_000_000) src = src.slice(0, 2_000_000);
    for (const re of DEEP_IMPORT_PATTERNS) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(src)) !== null) {
        const spec = m[1];
        if (spec) {
          // Strip extension suffixes that appear in some requires
          found.add(spec.replace(/\.(js|tsx?|mjs|cjs)$/, ""));
        }
      }
    }
  }
  return found;
}

export type DeepImportHit = {
  package: string;
  specifier: string;
};

/** Scan catalog packages for deep RN imports. */
export function collectCatalogDeepImports(sandboxRoot: string, catalog: readonly CatalogEntry[]): DeepImportHit[] {
  const nm = sandboxNodeModules(sandboxRoot);
  if (!existsSync(nm)) return [];
  const hits: DeepImportHit[] = [];
  for (const entry of catalog) {
    const dir = packageDir(nm, entry.name);
    if (!dir) continue;
    for (const spec of scanDeepImports(dir)) {
      hits.push({ package: entry.name, specifier: spec });
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
export function collectPlatformHazards(sandboxRoot: string, catalog: readonly CatalogEntry[]): PlatformHazard[] {
  const nm = sandboxNodeModules(sandboxRoot);
  if (!existsSync(nm)) return [];
  const hazards: PlatformHazard[] = [];

  for (const entry of catalog) {
    const dir = packageDir(nm, entry.name);
    if (!dir) continue;
    let resolved: string | null = null;
    try {
      resolved = Bun.resolveSync(entry.name, sandboxRoot);
    } catch {
      // try package.json main
      try {
        const pkg = JSON.parse(readFileSync(path.join(dir, "package.json"), "utf8")) as {
          main?: string;
          "react-native"?: string;
        };
        const main = pkg["react-native"] ?? pkg.main;
        if (main) resolved = path.resolve(dir, main);
      } catch {
        continue;
      }
    }
    if (!resolved || !existsSync(resolved)) continue;

    const base = path.basename(resolved);
    if (/\.(ios|android|native)\.[cm]?[jt]sx?$/.test(base)) {
      hazards.push({ package: entry.name, entry: resolved, reason: "platform-ext" });
    }

    try {
      const src = readFileSync(resolved, "utf8");
      if (/import\s*\{\s*type\s+\w+/.test(src) || /import\s+type\s*\{/.test(src) === false) {
        // Bun rejects `import { type X }` (inline type) in some RN packages
        if (/import\s*\{[^}]*\btype\s+[A-Za-z]/.test(src)) {
          hazards.push({ package: entry.name, entry: resolved, reason: "import-type" });
        }
      }
    } catch {
      // ignore
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

/** True when Bun CJS interop unwrapped a component/function as the module itself. */
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
    // Bun often unwraps `{ default: Component }` to the component itself.
    if (isModuleAsValue(mod)) return mod;
    return mod;
  }
  // Named export requested but module was unwrapped to the component.
  if (
    isModuleAsValue(mod) &&
    (name === "FlashList" || name === "Picker" || name === "WebView" || name === "BottomSheet" || name === "Svg")
  ) {
    return mod;
  }
  return undefined;
}
