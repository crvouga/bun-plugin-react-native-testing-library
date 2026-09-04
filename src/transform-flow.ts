/**
 * Flow / Hermes / RN component-syntax transform via @react-native/babel-preset,
 * with an LRU memory cache and optional disk cache.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import * as babel from "@babel/core";

export const PLUGIN_VERSION = "0.1.0";

export type TransformOptions = {
  filename: string;
  platform?: "ios" | "android";
  debug?: boolean;
};

export type TransformResult = {
  code: string;
  cacheHit: boolean;
  ms: number;
};

export type TransformFn = (code: string, opts: TransformOptions) => string;

/**
 * Strip Flow / transform RN component syntax so Bun's transpiler accepts the output.
 */
export function transformFlow(code: string, opts: TransformOptions): string {
  const result = babel.transformSync(code, {
    filename: opts.filename,
    babelrc: false,
    configFile: false,
    compact: false,
    sourceMaps: false,
    // RN preset understands Flow + Hermes component/hook syntax.
    presets: [
      [
        require.resolve("@react-native/babel-preset"),
        {
          // Emit CommonJS so Bun can load the result with loader: "js"
          // without fighting ESM/CJS interop on RN's require()-heavy graph.
          disableImportExportTransform: false,
          enableBabelRuntime: false,
          lazyImportExportTransform: false,
        },
      ],
    ],
    caller: {
      name: "bun-plugin-react-native-testing-library",
      platform: opts.platform ?? "ios",
    },
  });

  if (!result?.code) {
    throw new Error(`Flow transform produced empty output for ${opts.filename}`);
  }
  return result.code;
}

export type CacheOptions = {
  cacheDir?: string | null;
  version?: string;
  transform?: TransformFn;
  debug?: boolean;
  /** Max in-memory entries (LRU by insertion order via Map). Default 512. */
  maxMemoryEntries?: number;
};

export type TransformCache = {
  transform: (code: string, opts: TransformOptions & { mtimeMs?: number; size?: number }) => TransformResult;
  stats: () => { hits: number; misses: number };
  clear: () => void;
};

function cacheKey(parts: {
  path: string;
  mtimeMs: number;
  size: number;
  version: string;
  platform: string;
}): string {
  return createHash("sha1")
    .update(
      [
        parts.path,
        String(parts.mtimeMs),
        String(parts.size),
        parts.version,
        parts.platform,
        // Include babel preset version so upgrades invalidate.
        "rn-babel-0.87.1",
      ].join("|"),
    )
    .digest("hex");
}

export function createTransformCache(options: CacheOptions = {}): TransformCache {
  const memory = new Map<string, string>();
  const max = options.maxMemoryEntries ?? 512;
  const version = options.version ?? PLUGIN_VERSION;
  const transformImpl = options.transform ?? transformFlow;
  const cacheDir = options.cacheDir ?? null;
  const debug = options.debug ?? false;
  let hits = 0;
  let misses = 0;

  if (cacheDir) {
    try {
      mkdirSync(cacheDir, { recursive: true });
    } catch {
      // ignore
    }
  }

  function touch(key: string, value: string) {
    // LRU: delete + re-set moves to end
    if (memory.has(key)) memory.delete(key);
    memory.set(key, value);
    while (memory.size > max) {
      const oldest = memory.keys().next().value;
      if (oldest === undefined) break;
      memory.delete(oldest);
    }
  }

  function transform(
    code: string,
    opts: TransformOptions & { mtimeMs?: number; size?: number },
  ): TransformResult {
    const started = performance.now();
    let mtimeMs = opts.mtimeMs;
    let size = opts.size;
    if (mtimeMs === undefined || size === undefined) {
      try {
        const st = statSync(opts.filename);
        mtimeMs = st.mtimeMs;
        size = st.size;
      } catch {
        mtimeMs = 0;
        size = code.length;
      }
    }

    const key = cacheKey({
      path: opts.filename,
      mtimeMs,
      size,
      version,
      platform: opts.platform ?? "ios",
    });

    const mem = memory.get(key);
    if (mem !== undefined) {
      hits++;
      touch(key, mem);
      const ms = performance.now() - started;
      if (debug) console.log(`[rn-bun] cache HIT (mem) ${opts.filename} ${ms.toFixed(1)}ms`);
      return { code: mem, cacheHit: true, ms };
    }

    if (cacheDir) {
      const diskPath = path.join(cacheDir, `${key}.js`);
      if (existsSync(diskPath)) {
        try {
          const disk = readFileSync(diskPath, "utf8");
          touch(key, disk);
          hits++;
          const ms = performance.now() - started;
          if (debug) console.log(`[rn-bun] cache HIT (disk) ${opts.filename} ${ms.toFixed(1)}ms`);
          return { code: disk, cacheHit: true, ms };
        } catch {
          // fall through to transform
        }
      }
    }

    misses++;
    const out = transformImpl(code, opts);
    touch(key, out);
    if (cacheDir) {
      try {
        writeFileSync(path.join(cacheDir, `${key}.js`), out, "utf8");
      } catch {
        // ignore disk write failures
      }
    }
    const ms = performance.now() - started;
    if (debug) console.log(`[rn-bun] cache MISS ${opts.filename} ${ms.toFixed(1)}ms`);
    return { code: out, cacheHit: false, ms };
  }

  return {
    transform,
    stats: () => ({ hits, misses }),
    clear: () => {
      memory.clear();
      hits = 0;
      misses = 0;
    },
  };
}
