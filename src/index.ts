/**
 * Pure plugin factory — no import-time side effects.
 *
 * `createReactNativePlugin(options)` returns a `BunPlugin` that:
 *  1. Resolves Metro-style platform extensions (`.ios.js` / `.android.js` / `.native.js`)
 *  2. Transforms Flow / Hermes component syntax in react-native sources
 *  3. Stubs asset imports
 *
 * Strategy for the known Bun `onLoad`+`node_modules` pitfall (oven-sh/bun#10083):
 *  - `"direct"`: onLoad filter matches the real filesystem path
 *  - `"namespace"`: onResolve rewrites into `rn-flow:` then onLoad on that namespace
 *  - `"auto"`: try direct first; callers (preload) can force a strategy after probing
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import type { BunPlugin } from "bun";
import { assetModuleSource, isAssetPath } from "./assets.ts";
import { type PluginOptions, type ResolvedConfig, resolveConfig } from "./config.ts";
import { resolvePlatformFile } from "./resolve.ts";
import { createTransformCache, PLUGIN_VERSION } from "./transform-flow.ts";

export type { PluginOptions, ResolvedConfig, Platform, LoadStrategy } from "./config.ts";
export { resolveConfig, loadConfig, DEFAULT_ASSET_EXTS } from "./config.ts";
export { resolvePlatformFile, candidatePaths, brokenResolveSkipNative } from "./resolve.ts";
export { transformFlow, createTransformCache, PLUGIN_VERSION } from "./transform-flow.ts";
export { assetModuleSource, isAssetPath } from "./assets.ts";

export const FLOW_NAMESPACE = "rn-flow";

function shouldTransform(filePath: string, config: ResolvedConfig): boolean {
  const normalized = filePath.replaceAll("\\", "/");
  // Never transform tooling packages (babel preset etc.) — they are already plain JS/TS.
  if (
    normalized.includes("/node_modules/@react-native/babel-") ||
    normalized.includes("/node_modules/@babel/") ||
    normalized.includes("/node_modules/babel-")
  ) {
    return false;
  }
  if (!config.include.some((inc) => normalized.includes(inc))) return false;
  if (config.exclude.some((exc) => normalized.includes(exc))) return false;
  // Only transform JS-like sources (Flow lives in .js; skip .ts/.tsx/.json/.d.ts)
  if (/\.(ts|tsx|json|d\.ts)$/.test(normalized)) return false;
  if (!/\.(js|jsx|mjs|cjs)$/.test(normalized)) {
    // react-native sometimes has extensionless deep requires — still skip non-js
    return false;
  }
  return true;
}

function isRelativeSpecifier(spec: string): boolean {
  return spec.startsWith("./") || spec.startsWith("../");
}

export function createReactNativePlugin(options: PluginOptions = {}): BunPlugin {
  const config = resolveConfig(options);
  const cache = createTransformCache({
    cacheDir: config.cacheDir,
    version: PLUGIN_VERSION,
    debug: config.debug,
  });

  const strategy = config.strategy === "auto" ? "namespace" : config.strategy;
  // Default "auto" to namespace — it's the safe fallback for the #10083 pitfall.
  // Preload can override to "direct" after a successful probe.

  return {
    name: "bun-plugin-react-native-testing-library",
    setup(build) {
      // --- Platform extension resolution (relative imports only) ---
      build.onResolve({ filter: /.*/ }, (args) => {
        if (!isRelativeSpecifier(args.path)) {
          // Namespace rewrite for absolute paths already resolved into RN.
          if (
            strategy === "namespace" &&
            path.isAbsolute(args.path) &&
            shouldTransform(args.path, config)
          ) {
            return { path: args.path, namespace: FLOW_NAMESPACE };
          }
          return;
        }

        const importerDir = args.importer ? path.dirname(args.importer) : process.cwd();
        const resolved = resolvePlatformFile(
          args.path,
          importerDir,
          config.platform,
          existsSync,
        );

        if (resolved) {
          if (strategy === "namespace" && shouldTransform(resolved, config)) {
            return { path: resolved, namespace: FLOW_NAMESPACE };
          }
          return { path: resolved };
        }

        // Even without a platform hit, rewrite RN absolute-ish relative targets
        // into the flow namespace when using namespace strategy.
        if (strategy === "namespace") {
          const abs = path.resolve(importerDir, args.path);
          // Try with common extensions
          for (const ext of ["", ".js", ".jsx"]) {
            const candidate = abs + ext;
            if (existsSync(candidate) && shouldTransform(candidate, config)) {
              return { path: candidate, namespace: FLOW_NAMESPACE };
            }
          }
        }
        return;
      });

      // Catch already-resolved absolute paths into react-native (importer may
      // pass them after Bun's own resolver) — only for namespace strategy.
      if (strategy === "namespace") {
        build.onResolve({ filter: /node_modules\/(react-native|@react-native)\// }, (args) => {
          const abs = path.isAbsolute(args.path)
            ? args.path
            : (() => {
                try {
                  return Bun.resolveSync(args.path, args.importer ? path.dirname(args.importer) : process.cwd());
                } catch {
                  return null;
                }
              })();
          if (abs && shouldTransform(abs, config)) {
            return { path: abs, namespace: FLOW_NAMESPACE };
          }
          return;
        });
      }

      // --- Asset stubs ---
      const assetFilter = new RegExp(
        `\\.(${config.assetExts.map((e) => e.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})$`,
        "i",
      );
      build.onLoad({ filter: assetFilter }, (args) => {
        if (!isAssetPath(args.path, config.assetExts)) return;
        return {
          contents: assetModuleSource(args.path),
          loader: "js",
        };
      });

      // --- Flow transform ---
      const loadHandler = (args: { path: string }) => {
        if (!shouldTransform(args.path, config) && args.path.indexOf("\0") < 0) {
          // In namespace mode we always transform whatever landed here.
          if (strategy !== "namespace") return;
        }
        let code: string;
        try {
          code = readFileSync(args.path, "utf8");
        } catch (err) {
          throw new Error(
            `[rn-bun] Failed to read ${args.path} for Flow transform: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
        let mtimeMs = 0;
        let size = code.length;
        try {
          const st = statSync(args.path);
          mtimeMs = st.mtimeMs;
          size = st.size;
        } catch {
          // ignore
        }
        const result = cache.transform(code, {
          filename: args.path,
          platform: config.platform,
          debug: config.debug,
          mtimeMs,
          size,
        });
        return {
          contents: result.code,
          loader: "js" as const,
        };
      };

      if (strategy === "direct") {
        build.onLoad(
          { filter: /node_modules\/(react-native|@react-native)\// },
          loadHandler,
        );
      } else {
        build.onLoad({ filter: /.*/, namespace: FLOW_NAMESPACE }, loadHandler);
      }
    },
  };
}

export default createReactNativePlugin;
