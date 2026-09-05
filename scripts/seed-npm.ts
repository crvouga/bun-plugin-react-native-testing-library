/**
 * One-time (or CI bootstrap) publish so the package exists on npm and Trusted
 * Publisher can be configured. npm cannot create a brand-new package via OIDC
 * alone — see https://github.com/npm/cli/issues/8544.
 *
 * Local (interactive login, no Automation token):
 *   bun run npm:seed -- --dry-run
 *   bun run npm:seed -- --yes
 *   bun run npm:seed -- --yes --otp=123456
 *
 * CI (idempotent; uses NPM_TOKEN only when the package is missing):
 *   bun run npm:seed -- --ci
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { $ } from "bun";
import {
  GITHUB_REPO,
  hasFlag,
  NPM_PACKAGE,
  NPM_PACKAGE_URL,
  NPM_SEED_VERSION,
  NPM_TRUSTED_PUBLISHER_URL,
  npmViewVersion,
  redactSecrets,
  root,
  run,
} from "./secrets/lib.ts";

const NPM_2FA_URL = "https://www.npmjs.com/settings/~/account";
const argv = process.argv.slice(2);
const dryRun = hasFlag(argv, "--dry-run");
const yes = hasFlag(argv, "--yes");
const ci = hasFlag(argv, "--ci");

function otpFromArgv(args: string[]): string | undefined {
  const eq = args.find((a) => a.startsWith("--otp="));
  if (eq) {
    return eq.slice("--otp=".length).trim();
  }
  const i = args.indexOf("--otp");
  if (i >= 0) {
    return args[i + 1]?.trim();
  }
  return process.env.NPM_OTP?.trim() || undefined;
}

type NpmProfile = {
  name?: string;
  tfa?: { pending?: boolean; mode?: string } | false | null;
  "two-factor auth"?: string | boolean;
};

async function npmProfile(): Promise<NpmProfile | null> {
  const result = await run(["npm", "profile", "get", "--json"]);
  if (!result.ok) {
    return null;
  }
  try {
    return JSON.parse(result.stdout) as NpmProfile;
  } catch {
    return null;
  }
}

function tfaMode(profile: NpmProfile | null): string | null {
  if (!profile) {
    return null;
  }
  const labeled = profile["two-factor auth"];
  if (typeof labeled === "string" && labeled && labeled !== "disabled") {
    return labeled;
  }
  if (profile.tfa && typeof profile.tfa === "object" && profile.tfa.mode) {
    return profile.tfa.mode;
  }
  return null;
}

function print2faHelp(): void {
  console.error("");
  console.error("npm does not email a publish code. Publishing requires account 2FA via");
  console.error("authenticator app or a browser window.");
  console.error("");
  console.error("1. Enable 2FA on your npm account (authenticator, not email):");
  console.error(`     ${NPM_2FA_URL}`);
  console.error("     or: npm profile enable-2fa auth-and-writes");
  console.error("2. Re-login so the CLI can open a browser challenge:");
  console.error("     npm logout");
  console.error("     npm login --auth-type=web");
  console.error("3. Re-run (a browser tab should open — do not pass a made-up OTP):");
  console.error("     bun run npm:seed -- --yes");
  console.error("");
  console.error("Optional: 6-digit code from the authenticator app (not email):");
  console.error("     bun run npm:seed -- --yes --otp=123456");
}

function nextSteps(): void {
  console.log("");
  console.log("Next: enable Trusted Publisher (do not create a granular token):");
  console.log(`  ${NPM_TRUSTED_PUBLISHER_URL}`);
  console.log("  GitHub Actions → org/user: crvouga  repo: bun-plugin-react-native-testing-library  workflow: ci.yml");
  console.log("");
  console.log("Then (if the baseline git tag is missing):");
  console.log(`  git tag v${NPM_SEED_VERSION}`);
  console.log(`  git push origin v${NPM_SEED_VERSION}`);
  console.log("");
  console.log("Docs: docs/SECRETS.md");
}

async function ensureBaselineTag(): Promise<void> {
  const tag = `v${NPM_SEED_VERSION}`;
  const existing = await run(["git", "rev-parse", "--verify", "--quiet", `refs/tags/${tag}`]);
  if (existing.ok) {
    console.log(`git tag ${tag} already exists`);
    return;
  }
  const create = await run(["git", "tag", tag]);
  if (!create.ok) {
    console.error(`FAIL: could not create git tag ${tag}`);
    console.error(redactSecrets(create.stderr || create.stdout));
    process.exit(1);
  }
  console.log(`Created local git tag ${tag}`);

  // In Actions, persist-credentials is false; push with GITHUB_TOKEN if available.
  const token = process.env.GITHUB_TOKEN?.trim();
  if (process.env.GITHUB_ACTIONS === "true" && token) {
    const remote = `https://x-access-token:${token}@github.com/${GITHUB_REPO}.git`;
    const push = await run(["git", "push", remote, `refs/tags/${tag}`], {
      env: { ...process.env, GITHUB_TOKEN: undefined },
    });
    if (!push.ok) {
      console.error(`FAIL: could not push tag ${tag}`);
      console.error(redactSecrets(push.stderr || push.stdout));
      process.exit(1);
    }
    console.log(`Pushed git tag ${tag}`);
  } else {
    console.log(`Push when ready: git push origin ${tag}`);
  }
}

async function packAndPublish(opts: {
  dryRun: boolean;
  authType?: "web";
  otp?: string;
  token?: string;
}): Promise<void> {
  console.log("");
  console.log("Verifying package…");
  const verify = await $`bun run verify-package`.cwd(root);
  if (verify.exitCode !== 0) {
    process.exit(verify.exitCode ?? 1);
  }

  const work = mkdtempSync(join(tmpdir(), "rn-bun-seed-"));
  const packDir = join(work, "pack");
  mkdirSync(packDir, { recursive: true });

  try {
    console.log("Packing (ignore-scripts)…");
    const pack = await $`npm pack --ignore-scripts --pack-destination ${packDir}`.cwd(root).nothrow();
    if (pack.exitCode !== 0) {
      console.error(redactSecrets(pack.stderr.toString() || pack.stdout.toString()));
      console.error("FAIL: npm pack failed");
      process.exit(1);
    }

    const tarballs = Array.from(new Bun.Glob("*.tgz").scanSync({ cwd: packDir }));
    if (tarballs.length !== 1) {
      console.error(`FAIL: expected one tarball, found ${tarballs.length}`);
      process.exit(1);
    }
    const tarball = join(packDir, tarballs[0]!);

    const extract = join(work, "extract");
    mkdirSync(extract);
    const tar = await $`tar -xzf ${tarball} -C ${extract}`.nothrow();
    if (tar.exitCode !== 0) {
      console.error("FAIL: could not extract npm pack tarball");
      process.exit(1);
    }

    const pkgDir = join(extract, "package");
    const pkgPath = join(pkgDir, "package.json");
    const pkg = await Bun.file(pkgPath).json();
    pkg.version = NPM_SEED_VERSION;
    pkg.publishConfig = { ...(pkg.publishConfig ?? {}), access: "public", provenance: false };
    writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

    const publishArgs = ["npm", "publish", "--access", "public", "--ignore-scripts", "--no-provenance"];
    if (opts.authType) {
      publishArgs.push(`--auth-type=${opts.authType}`);
    }
    if (opts.dryRun) {
      publishArgs.push("--dry-run");
    } else if (opts.otp) {
      if (!/^\d{6}$/.test(opts.otp)) {
        console.error("FAIL: --otp must be the 6-digit code from your authenticator app.");
        console.error("npm does not email this code.");
        process.exit(1);
      }
      publishArgs.push("--otp", opts.otp);
    }

    console.log("");
    if (opts.dryRun) {
      console.log(`Dry-run: would publish ${NPM_PACKAGE}@${NPM_SEED_VERSION}`);
    } else if (opts.token) {
      console.log(`Publishing ${NPM_PACKAGE}@${NPM_SEED_VERSION} with NPM_TOKEN (CI bootstrap)…`);
    } else if (opts.otp) {
      console.log(`Publishing ${NPM_PACKAGE}@${NPM_SEED_VERSION} with authenticator TOTP…`);
    } else {
      console.log(`Publishing ${NPM_PACKAGE}@${NPM_SEED_VERSION}…`);
      console.log("Expect a browser window for npm 2FA (not an email).");
    }

    const env = { ...process.env };
    if (opts.token) {
      env.NODE_AUTH_TOKEN = opts.token;
      env.NPM_TOKEN = opts.token;
    } else {
      delete env.NPM_TOKEN;
      delete env.NODE_AUTH_TOKEN;
    }

    const proc = Bun.spawn(publishArgs, {
      cwd: pkgDir,
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
      env,
    });
    const code = await proc.exited;
    if (code !== 0) {
      console.error("");
      console.error("FAIL: npm publish failed. See the npm error above.");
      console.error(`This repo publishes as ${NPM_PACKAGE} (--access public).`);
      if (!opts.token) {
        print2faHelp();
      }
      process.exit(code);
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

const existing = await npmViewVersion(NPM_PACKAGE);
if (existing.error) {
  console.error("FAIL: could not query the npm registry:", existing.error);
  process.exit(1);
}
if (!existing.missing) {
  console.log(`${NPM_PACKAGE}@${existing.version} already exists on npm.`);
  console.log(`  ${NPM_PACKAGE_URL}`);
  if (ci) {
    console.log("npm:seed --ci: nothing to do (idempotent no-op).");
  } else {
    nextSteps();
  }
  process.exit(0);
}

console.log(`${NPM_PACKAGE} is not on the npm registry yet.`);
console.log("Trusted Publishing can only be enabled after a first publish.");
console.log(`This seed publishes ${NPM_PACKAGE}@${NPM_SEED_VERSION}.`);
console.log("");

// --- CI bootstrap path ---
if (ci) {
  if (process.env.GITHUB_ACTIONS !== "true") {
    console.error("FAIL: --ci is only for GitHub Actions.");
    console.error("Locally: bun run npm:seed -- --yes");
    process.exit(1);
  }
  const token = process.env.NPM_TOKEN?.trim() || process.env.NODE_AUTH_TOKEN?.trim();
  if (!token) {
    console.error("FAIL: package missing on npm and NPM_TOKEN is not set.");
    console.error("");
    console.error("npm cannot create a brand-new package via OIDC alone.");
    console.error("Bootstrap once (pick one):");
    console.error("  A) Local:  npm login --auth-type=web && bun run npm:seed -- --yes");
    console.error("  B) CI:     add a short-lived NPM_TOKEN secret, re-run release, then delete it");
    console.error("After seed: enable Trusted Publisher, then remove NPM_TOKEN.");
    console.error("Docs: docs/SECRETS.md");
    process.exit(1);
  }

  await packAndPublish({ dryRun: false, token });
  console.log("");
  console.log(`npm:seed OK — ${NPM_PACKAGE}@${NPM_SEED_VERSION} is on the registry.`);
  console.log(`  ${NPM_PACKAGE_URL}`);
  await ensureBaselineTag();
  console.log("");
  console.log("Configure Trusted Publisher, then delete NPM_TOKEN from the repo.");
  nextSteps();
  process.exit(0);
}

// --- Local interactive path ---
if (!dryRun && !yes) {
  console.error("Refusing to publish without --yes (or use --dry-run / --ci).");
  console.error("Usage: bun run npm:seed -- --yes");
  console.error("       bun run npm:seed -- --dry-run");
  console.error("       bun run npm:seed -- --ci");
  process.exit(2);
}

if (!dryRun && (process.env.NPM_TOKEN?.trim() || process.env.NODE_AUTH_TOKEN?.trim())) {
  console.error("FAIL: NPM_TOKEN / NODE_AUTH_TOKEN is set.");
  console.error("Unset them so this seed uses `npm login` (interactive), not a CI token:");
  console.error("  unset NPM_TOKEN NODE_AUTH_TOKEN");
  console.error("Or use: bun run npm:seed -- --ci  (Actions only)");
  process.exit(1);
}

if (!dryRun) {
  const whoami = await run(["npm", "whoami"]);
  if (!whoami.ok) {
    console.error("FAIL: not logged in to npm.");
    console.error("  npm login --auth-type=web");
    console.error("Then re-run: bun run npm:seed -- --yes");
    process.exit(1);
  }
  console.log(`npm user: ${whoami.stdout.trim()}`);

  const profile = await npmProfile();
  const tfa = tfaMode(profile);
  if (tfa) {
    console.log(`npm 2FA: ${tfa}`);
  } else {
    console.log("npm 2FA: not detected on this profile");
    console.error("FAIL: npm requires 2FA to publish. It will not email a code.");
    print2faHelp();
    process.exit(1);
  }
} else {
  console.log("Dry-run: skipping npm login / 2FA checks");
}

await packAndPublish({
  dryRun,
  authType: dryRun ? undefined : "web",
  otp: otpFromArgv(argv),
});

if (dryRun) {
  console.log("npm:seed dry-run OK (nothing published)");
  process.exit(0);
}

console.log("");
console.log(`npm:seed OK — ${NPM_PACKAGE}@${NPM_SEED_VERSION} is on the registry.`);
console.log(`  ${NPM_PACKAGE_URL}`);
nextSteps();
process.exit(0);
