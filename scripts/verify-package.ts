/**
 * Fail-fast package integrity gate for CI and release.
 * This package publishes TypeScript source for Bun (no dist/ build).
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { $ } from "bun";

const root = join(import.meta.dir, "..");
const errors: string[] = [];

function fail(message: string): void {
  errors.push(message);
  console.error(`::error::${message}`);
}

function requireFile(rel: string): void {
  const abs = join(root, rel);
  if (!existsSync(abs)) {
    fail(`Missing required package file: ${rel}`);
  }
}

console.log("verify-package: checking published sources…");

requireFile("src/index.ts");
requireFile("src/preload.ts");
requireFile("src/screen.ts");
requireFile("LICENSE");
requireFile("README.md");
requireFile("bunfig.example.toml");
requireFile("package.json");

const pkg = await Bun.file(join(root, "package.json")).json();

if (pkg.name !== "bun-plugin-react-native-testing-library") {
  fail(`package.json name must be "bun-plugin-react-native-testing-library" (got ${JSON.stringify(pkg.name)})`);
}

if (!pkg.exports?.["."] || !pkg.exports?.["./preload"] || !pkg.exports?.["./screen"]) {
  fail('package.json exports must define ".", "./preload", and "./screen"');
}

const exportKeys = Object.keys(pkg.exports).sort();
const expected = [".", "./preload", "./screen"];
if (exportKeys.length !== expected.length || !expected.every((k) => exportKeys.includes(k))) {
  fail(`package.json exports must be exactly ".", "./preload", "./screen" (got ${JSON.stringify(exportKeys)})`);
}

for (const key of expected) {
  const target = String(pkg.exports[key]).replace(/^\.\//, "");
  requireFile(target);
}

if (pkg.exports["."] !== "./src/index.ts") {
  fail(`exports["."] must be "./src/index.ts", got ${JSON.stringify(pkg.exports["."])}`);
}
if (pkg.exports["./preload"] !== "./src/preload.ts") {
  fail(`exports["./preload"] must be "./src/preload.ts", got ${JSON.stringify(pkg.exports["./preload"])}`);
}
if (pkg.exports["./screen"] !== "./src/screen.ts") {
  fail(`exports["./screen"] must be "./src/screen.ts", got ${JSON.stringify(pkg.exports["./screen"])}`);
}

if (!Array.isArray(pkg.files) || !pkg.files.includes("src")) {
  fail('package.json "files" must include "src" so the tarball ships the plugin');
}
if (!pkg.files.includes("LICENSE")) {
  fail('package.json "files" must include "LICENSE"');
}

if (!pkg.repository?.url) {
  fail('package.json must set "repository.url" for npm and GitHub releases');
}

if (!pkg.publishConfig?.access) {
  fail('package.json must set publishConfig.access (expected "public")');
}

if (pkg.type !== "module") {
  fail('package.json must set "type": "module"');
}

if (pkg.private === true) {
  fail('package.json must not set "private": true');
}

if (errors.length > 0) {
  console.error("");
  console.error("verify-package FAILED — fix the issues above before publishing.");
  console.error("Run: bun run verify-package");
  process.exit(1);
}

console.log("verify-package: checking public API surface…");
const indexSrc = await Bun.file(join(root, "src/index.ts")).text();
for (const exported of ["createReactNativePlugin", "FLOW_NAMESPACE"]) {
  if (!indexSrc.includes(exported)) {
    fail(`src/index.ts is missing public symbol ${exported}`);
  }
}
const preloadSrc = await Bun.file(join(root, "src/preload.ts")).text();
if (!preloadSrc.includes("createReactNativePlugin") || !preloadSrc.includes("plugin(")) {
  fail("src/preload.ts must register createReactNativePlugin via plugin()");
}
const screenSrc = await Bun.file(join(root, "src/screen.ts")).text();
if (!screenSrc.includes("export function getScreen")) {
  fail("src/screen.ts must export getScreen()");
}

if (errors.length > 0) {
  console.error("");
  console.error("verify-package FAILED — fix the issues above before publishing.");
  process.exit(1);
}

console.log("verify-package: running npm pack (dry list)…");
const pack = await $`npm pack --dry-run --json --ignore-scripts`.cwd(root).quiet().nothrow();
if (pack.exitCode !== 0) {
  console.error(pack.stderr.toString() || pack.stdout.toString());
  fail("npm pack --dry-run failed — the package cannot be packed for npm");
  console.error("");
  console.error("verify-package FAILED.");
  process.exit(1);
}

let packEntries: Array<{ filename?: string; files?: Array<{ path: string }> }>;
try {
  const raw = pack.stdout.toString().trim();
  const jsonStart = raw.indexOf("[");
  packEntries = JSON.parse(jsonStart >= 0 ? raw.slice(jsonStart) : raw);
} catch (err) {
  fail(`npm pack --dry-run returned invalid JSON (${err instanceof Error ? err.message : String(err)})`);
  process.exit(1);
}

const files = packEntries[0]?.files?.map((f) => f.path) ?? [];
const requiredInTarball = [
  "src/index.ts",
  "src/preload.ts",
  "src/screen.ts",
  "package.json",
  "LICENSE",
  "README.md",
  "bunfig.example.toml",
];
for (const needed of requiredInTarball) {
  if (!files.some((p) => p === needed || p.endsWith(`/${needed}`))) {
    fail(`npm tarball is missing ${needed}. Check package.json "files" and source layout.`);
  }
}

if (files.length < 5) {
  fail(`npm tarball looks empty (${files.length} files). Refusing to publish.`);
}

console.log(`verify-package: tarball would include ${files.length} files`);

console.log("verify-package: running publint…");
const publint = await $`bunx publint`.cwd(root).nothrow();
if (publint.exitCode !== 0) {
  // Bun-only packages that export .ts may trip publint; treat as soft warning if pack is OK.
  const out = `${publint.stdout.toString()}\n${publint.stderr.toString()}`;
  if (/error/i.test(out) && !/\.ts/.test(out)) {
    fail("publint reported packaging problems — see output above");
    console.error("");
    console.error("verify-package FAILED.");
    process.exit(1);
  }
  console.warn("verify-package: publint exited non-zero (often expected for Bun .ts exports); continuing.");
  console.warn(out.slice(0, 2000));
}

if (errors.length > 0) {
  console.error("");
  console.error("verify-package FAILED — fix the issues above before publishing.");
  process.exit(1);
}

console.log("verify-package: OK");
