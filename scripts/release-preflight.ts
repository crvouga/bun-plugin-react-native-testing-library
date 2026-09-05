/**
 * Loud preflight checks before semantic-release runs on main.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
let failed = false;

function error(title: string, details: string[]): void {
  failed = true;
  console.error(`::error::${title}`);
  console.error("");
  console.error(`ERROR: ${title}`);
  console.error("=".repeat(72));
  for (const line of details) {
    console.error(line);
  }
  console.error("=".repeat(72));
  console.error("");
}

const npmToken = process.env.NPM_TOKEN?.trim() ?? "";
const inActions = process.env.GITHUB_ACTIONS === "true";
const oidcReady = Boolean(process.env.ACTIONS_ID_TOKEN_REQUEST_URL);

if (inActions && !npmToken && !oidcReady) {
  error("No npm publish credentials — cannot publish to npm", [
    "semantic-release needs Trusted Publishing (OIDC) for https://registry.npmjs.org",
    "",
    "Configure npm Trusted Publishing (do not create an Automation token):",
    "  1. https://www.npmjs.com/package/bun-plugin-react-native-testing-library → Settings → Trusted Publisher",
    "  2. Add GitHub Actions publisher:",
    "       Organization/user: crvouga",
    "       Repository: bun-plugin-react-native-testing-library",
    "       Workflow filename: ci.yml",
    "       Environment: (leave empty unless you use one)",
    "  3. Re-run this workflow (id-token: write is already set on the release job)",
    "",
    "If the package does not exist yet, seed it first:",
    "  bun run npm:seed -- --yes   (local)  OR  set NPM_TOKEN once for CI seed",
    "",
    "Docs: https://docs.npmjs.com/trusted-publishers",
    "Maintainer checklist: bun run secrets:doctor  →  docs/SECRETS.md",
    "Without this, publish fails with a cryptic npm 401.",
  ]);
}

if (inActions && !npmToken && oidcReady) {
  console.log(
    "release-preflight: NPM_TOKEN unset; using GitHub OIDC (npm Trusted Publishing must be configured for bun-plugin-react-native-testing-library).",
  );
}

for (const rel of ["src/index.ts", "src/preload.ts", "src/screen.ts", "package.json", "LICENSE"]) {
  if (!existsSync(join(root, rel))) {
    error(`Missing ${rel} before release`, [
      "The release job must verify the package first.",
      "Run locally: bun run verify-package",
    ]);
  }
}

const pkg = await Bun.file(join(root, "package.json")).json();
if (pkg.private === true) {
  error('package.json has "private": true', [
    "npm will refuse to publish a private package.",
    'Remove "private" from package.json.',
  ]);
}

if (failed) {
  console.error("release-preflight FAILED — refusing to run semantic-release.");
  process.exit(1);
}

if (process.env.RN_BUN_RELEASE_GATE === "1" || process.env.GITHUB_ACTIONS === "true") {
  const reportPath = join(root, ".compat-out", "release-report.json");
  if (!existsSync(reportPath)) {
    error("Missing .compat-out/release-report.json from bun check", [
      "Release requires the canonical bun check report.",
      "Run: bun check",
    ]);
  } else {
    const report = JSON.parse(await Bun.file(reportPath).text()) as {
      ok?: boolean;
      sentinel?: string | null;
    };
    if (!report.ok || report.sentinel !== "RELEASE READY: bun check passed") {
      error(".compat-out/release-report.json is not RELEASE READY", [
        "Re-run bun check until it prints RELEASE READY: bun check passed",
      ]);
    }
  }
}

if (failed) {
  console.error("release-preflight FAILED — refusing to run semantic-release.");
  process.exit(1);
}

console.log("release-preflight: OK");
console.log("  - package sources present");
if (existsSync(join(root, ".compat-out", "release-report.json"))) {
  console.log("  - bun check release report present");
}
if (oidcReady) {
  console.log("  - OIDC token endpoint available (Trusted Publishing)");
  if (npmToken) {
    console.log("  - note: NPM_TOKEN is also set (used only for first-publish seed if needed)");
  }
} else if (npmToken) {
  console.log("  - NPM_TOKEN is set (legacy / first-publish seed); prefer Trusted Publishing — see docs/SECRETS.md");
} else {
  console.log("  - no npm credentials in this shell (local dry-run / configure Trusted Publishing for CI)");
}
