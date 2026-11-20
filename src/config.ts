/**
 * Plugin configuration.
 *
 * Pure helpers — no side effects at import time.
 */

import type { LibraryShim } from "./libraries/helpers.ts";
import { defineShim } from "./shim.ts";

export type Platform = "ios" | "android";

export type LoadStrategy = "auto" | "direct" | "namespace";

/**
 * Which third-party library shims to auto-register.
 * - `"auto"` (default): register when the package resolves from cwd
 * - `string[]`: only these registry names
 * - `false`: disable all library shims
 */
export type LibraryMocksOption = "auto" | readonly string[] | false;

export type WindowMetrics = {
  width: number;
  height: number;
  scale: number;
  fontScale: number;
};

/**
 * Consumer extension surface, set via `rn-bun.config.ts` or plugin options.
 * - `shims`: project-local shims (validated through `defineShim` on load)
 * - `compatPackages`: npm compat packages to load explicitly
 */
export type CompatConfig = {
  shims?: readonly LibraryShim[];
  compatPackages?: readonly string[];
};

export type ResolvedCompat = {
  localShims: readonly LibraryShim[];
  compatPackages: readonly string[];
};

export type PluginOptions = {
  /** Target platform for Metro-style resolution. Default: `"ios"`. */
  platform?: Platform;
  /** Asset file extensions to stub. */
  assetExts?: readonly string[];
  /** Absolute-path substrings that must be transformed (default: react-native packages). */
  include?: readonly string[];
  /** Absolute-path substrings to skip even if they match `include`. */
  exclude?: readonly string[];
  /** Disk cache directory for Flow transforms. Default: `.rn-bun-cache` in cwd. */
  cacheDir?: string;
  /** Log cache hits/misses and per-file transform times. */
  debug?: boolean;
  /** Window metrics returned by Dimensions / useWindowDimensions. */
  window?: Partial<WindowMetrics>;
  /**
   * How to intercept `node_modules/react-native/**` sources.
   * - `"auto"` (default): probe once, then pick direct or namespace
   * - `"direct"`: `onLoad` filter on the real filesystem path
   * - `"namespace"`: rewrite into `rn-flow:` then `onLoad` that namespace
   */
  strategy?: LoadStrategy;
  /** Third-party library mock registration. Default: `"auto"`. */
  libraryMocks?: LibraryMocksOption;
  /** Registry shim names to skip entirely, regardless of `libraryMocks`. */
  disable?: readonly string[];
  /** Consumer compatibility extension surface. */
  compat?: CompatConfig;
};

export type ResolvedConfig = {
  platform: Platform;
  assetExts: readonly string[];
  include: readonly string[];
  exclude: readonly string[];
  cacheDir: string;
  debug: boolean;
  window: WindowMetrics;
  strategy: LoadStrategy;
  libraryMocks: LibraryMocksOption;
  disable: readonly string[];
  compat: ResolvedCompat;
};

export const DEFAULT_ASSET_EXTS = [
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "svg",
  "bmp",
  "psd",
  "ttf",
  "otf",
  "woff",
  "woff2",
  "mp4",
  "mp3",
  "wav",
  "m4a",
  "aac",
] as const;

export const DEFAULT_INCLUDE = [
  "/node_modules/react-native/",
  "/node_modules/@react-native/virtualized-lists/",
  "/node_modules/@react-native/assets-registry/",
  "/node_modules/@react-native/js-polyfills/",
  "/node_modules/@react-native/normalize-colors/",
] as const;

export const DEFAULT_EXCLUDE = [
  "/node_modules/react-native/node_modules/",
  "/node_modules/@react-native/babel-preset/",
  "/node_modules/@react-native/babel-plugin-codegen/",
  "/node_modules/@react-native/codegen/",
  "/node_modules/@react-native/gradle-plugin/",
  "/node_modules/@react-native/community-cli-plugin/",
  ".d.ts",
] as const;

export const DEFAULT_WINDOW: WindowMetrics = {
  width: 390,
  height: 844,
  scale: 3,
  fontScale: 1,
};

export function resolveConfig(options: PluginOptions = {}): ResolvedConfig {
  return {
    platform: options.platform ?? "ios",
    assetExts: options.assetExts ?? DEFAULT_ASSET_EXTS,
    include: options.include ?? DEFAULT_INCLUDE,
    exclude: options.exclude ?? DEFAULT_EXCLUDE,
    cacheDir: options.cacheDir ?? `${process.cwd()}/.rn-bun-cache`,
    debug: options.debug ?? false,
    window: { ...DEFAULT_WINDOW, ...options.window },
    strategy: options.strategy ?? "auto",
    libraryMocks: options.libraryMocks ?? "auto",
    disable: options.disable ?? [],
    compat: {
      localShims: options.compat?.shims ?? [],
      compatPackages: options.compat?.compatPackages ?? [],
    },
  };
}

/** Parse `RN_BUN_LIBRARY_MOCKS` env: `auto` | `false` | `off` | comma-separated names. */
export function parseLibraryMocksEnv(raw: string | undefined): LibraryMocksOption | undefined {
  if (raw == null || raw === "") return undefined;
  const v = raw.trim().toLowerCase();
  if (v === "auto") return "auto";
  if (v === "false" || v === "off" || v === "0" || v === "none") return false;
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Load config from env vars (+ optional `rn-bun.config.ts` if present).
 * Used by the preload entry and by the doctor audit; pass `cwd` to audit or
 * load a directory other than the process cwd.
 */
export function loadConfig(cwd: string = process.cwd()): ResolvedConfig {
  const platformEnv = process.env.RN_BUN_PLATFORM;
  const platform = platformEnv === "android" || platformEnv === "ios" ? platformEnv : undefined;
  const debug = process.env.RN_BUN_DEBUG === "1" || process.env.RN_BUN_DEBUG === "true";
  const strategyEnv = process.env.RN_BUN_STRATEGY;
  const strategy =
    strategyEnv === "direct" || strategyEnv === "namespace" || strategyEnv === "auto" ? strategyEnv : undefined;

  let fileOpts: PluginOptions = {};
  try {
    // Optional consumer config — sync require so preload stays sync.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const resolved = Bun.resolveSync("./rn-bun.config.ts", cwd);
    // Dynamic import is async; for preload we use require via Bun.
    const mod = require(resolved);
    fileOpts = (mod?.default ?? mod ?? {}) as PluginOptions;
  } catch {
    // no config file — fine
  }

  const libraryMocks = parseLibraryMocksEnv(process.env.RN_BUN_LIBRARY_MOCKS) ?? fileOpts.libraryMocks;

  const compat = fileOpts.compat;
  if (compat?.shims) {
    // Validate consumer shims at load time so a broken shim names its file
    // and reason here, not as a mystery failure during registration.
    try {
      for (const shim of compat.shims) defineShim(shim);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      throw new Error(`[rn-bun] rn-bun.config.ts compat.shims: ${reason}`);
    }
  }

  return resolveConfig({
    ...fileOpts,
    platform: platform ?? fileOpts.platform,
    debug: debug || fileOpts.debug,
    strategy: strategy ?? fileOpts.strategy,
    cacheDir: process.env.RN_BUN_CACHE_DIR ?? fileOpts.cacheDir,
    libraryMocks,
    disable: fileOpts.disable,
    compat,
  });
}
