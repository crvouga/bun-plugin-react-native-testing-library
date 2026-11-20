/**
 * Actionable resolution failures.
 *
 * When an ecosystem-shaped specifier cannot resolve, the plugin routes the
 * import to a namespace module that throws a structured error naming the
 * specifier, the importer, and the next action. The import never silently
 * resolves to a mock: unknown behavior must fail clearly (fail-closed).
 */

import { readFileSync, statSync } from "node:fs";
import { packageResolves } from "./libraries/helpers.ts";

const ECOSYSTEM_SHAPES = [
  /^react-native$/,
  /^react-native-/,
  /^@react-native\//,
  /^@react-native-community\//,
  /^expo-/,
  /^@expo\//,
];

export function isEcosystemSpecifier(specifier: string): boolean {
  return ECOSYSTEM_SHAPES.some((p) => p.test(specifier));
}

export type DisabledShimInfo = {
  name: string;
  packages: readonly string[];
  targets?: readonly string[];
};

/**
 * Build the structured failure message for an unresolvable ecosystem import.
 * Pure: no side effects, exported for direct testing.
 */
export function buildResolutionError(args: {
  specifier: string;
  importer: string;
  disabledShims: readonly DisabledShimInfo[];
}): string {
  const { specifier, importer } = args;
  const lines: string[] = [];
  lines.push(`[rn-bun] Cannot resolve '${specifier}' imported from ${importer}.`);
  lines.push(`  This looks like a React Native / Expo package that has no active compatibility shim.`);

  const covering = args.disabledShims.filter((s) => s.packages.includes(specifier) || s.targets?.includes(specifier));
  for (const shim of covering) {
    lines.push(`  → A compatibility shim for it ("${shim.name}") exists but is disabled.`);
    lines.push(`    Re-enable it by removing "${shim.name}" from \`disable\` (or the \`libraryMocks\` filter).`);
  }

  if (covering.length === 0) {
    lines.push(`  → Write a shim for it in one file:`);
    lines.push(`      bun-rn-doctor scaffold ${specifier}`);
    lines.push(`    then register it in \`rn-bun.config.ts\` under \`compat.shims\`.`);
  }

  lines.push(`  Run \`bun-rn-doctor audit\` for the full compatibility report.`);
  return lines.join("\n");
}

export type DiagnosticsContext = {
  cwd: string;
  disabledShims: readonly DisabledShimInfo[];
};

/**
 * True when a specifer looks like an unresolved RN/Expo import. `shouldRouteToDiagnostics`
 * exists for embedders that can probe resolution themselves; under `bun test`,
 * the runtime never consults plugin resolvers for failing bare specifiers, so
 * the preload uses the static scanner below instead.
 */
export function shouldRouteToDiagnostics(specifier: string, ctx: DiagnosticsContext): boolean {
  if (!isEcosystemSpecifier(specifier)) return false;
  return !packageResolves(specifier, ctx.cwd);
}

const TEST_FILE_PATTERN = /\.(test|spec)\.(ts|tsx|js|jsx)$|_test\.(ts|tsx|js|jsx)$/;
const SKIP_DIRS = new Set(["node_modules", ".git", ".virt-rn-fixture", ".rn-bun-cache", "dist", "build", "out"]);
const SCAN_DEPTH_LIMIT = 6;
const SCAN_FILE_LIMIT = 500;

const IMPORT_PATTERNS: { re: RegExp; typeAware?: boolean }[] = [
  // Named/default/namespace imports: `import X from "p"`, `import { a } from "p"`.
  // Type-only imports are erased at runtime and cannot fail resolution.
  { re: /import\s+([^"';]+?)\s+from\s*["']([^"']+)["']/g, typeAware: true },
  // Side-effect imports: `import "p"`.
  { re: /import\s+["']([^"']+)["']/g },
  { re: /require\(\s*["']([^"']+)["']\s*\)/g },
  { re: /import\(\s*["']([^"']+)["']\s*\)/g },
];

function isTypeOnlyImport(clause: string): boolean {
  return clause.trim().startsWith("type ");
}

function* iterTestFiles(dir: string, depth: number, count: { n: number }): Generator<string> {
  if (depth > SCAN_DEPTH_LIMIT || count.n > SCAN_FILE_LIMIT) return;
  let entries;
  try {
    entries = Array.from(new Bun.Glob("*").scanSync({ cwd: dir, onlyFiles: false }));
  } catch {
    return;
  }
  for (const entry of entries) {
    if (count.n > SCAN_FILE_LIMIT) return;
    const full = `${dir}/${entry}`;
    let isDir = false;
    try {
      isDir = !statSync(full).isFile();
    } catch {
      continue;
    }
    if (isDir) {
      if (SKIP_DIRS.has(entry) || entry.startsWith(".")) continue;
      yield* iterTestFiles(full, depth + 1, count);
    } else if (TEST_FILE_PATTERN.test(entry)) {
      count.n += 1;
      yield full;
    }
  }
}

/**
 * Scan the project's test files for ecosystem-shaped imports that cannot
 * resolve, and return a structured warning per gap.
 *
 * Under `bun test` the runtime fails those imports with a bare "Cannot find
 * package" error before any plugin resolver runs, so the preload scans ahead
 * instead: the native failure stays loud, and the guidance is printed beside it.
 */
export function scanUnresolvedEcosystemImports(cwd: string, disabledShims: readonly DisabledShimInfo[]): string[] {
  const seen = new Set<string>();
  const warnings: string[] = [];
  const count = { n: 0 };
  for (const file of iterTestFiles(cwd, 0, count)) {
    let source: string;
    try {
      source = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    const specifiers = new Set<string>();
    for (const { re, typeAware } of IMPORT_PATTERNS) {
      re.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = re.exec(source)) != null) {
        if (typeAware && isTypeOnlyImport(match[1] ?? "")) continue;
        const spec = match[2] ?? match[1];
        if (spec && !spec.startsWith(".") && !spec.startsWith("/") && !spec.startsWith("#")) {
          specifiers.add(spec);
        }
      }
    }
    for (const specifier of specifiers) {
      const key = `${specifier}\0${file}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (!isEcosystemSpecifier(specifier)) continue;
      if (packageResolves(specifier, cwd)) continue;
      warnings.push(buildResolutionError({ specifier, importer: file, disabledShims }));
    }
  }
  return warnings;
}
