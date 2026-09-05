/**
 * Fail-closed fixture bootstrap: install sandbox deps with frozen lockfiles.
 *
 * Used by `bun check` before inventory / integration / walk stages.
 * Missing lockfiles or install failures are hard errors — never silent skips.
 *
 * Sandboxes do NOT list this package as a `file:`/`link:` dependency — that
 * caused Bun to hang copying the repo into itself. Bootstrap always symlinks
 * the plugin after install; sandbox bunfig preloads `../../src/preload.ts`.
 */
import { existsSync, lstatSync, readdirSync, renameSync, rmSync, symlinkSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const ROOT = join(import.meta.dir, "..");
const PLUGIN_NAME = "bun-plugin-react-native-testing-library";

export const FIXTURES = [
  { name: "real-world", dir: join(ROOT, "test", "real-world") },
  { name: "real-world-expo", dir: join(ROOT, "test", "real-world-expo") },
] as const;

/**
 * Bun may leave `.old-*` dirs after a failed/recursive install. Those trees can
 * be pathologically deep (self-copies) and hang `rm -rf` / Watchman. Move them
 * out of `node_modules` so install can proceed; delete best-effort afterward.
 */
function quarantineOldInstallDirs(cwd: string): void {
  const nm = join(cwd, "node_modules");
  if (!existsSync(nm)) return;
  for (const name of readdirSync(nm)) {
    if (!name.startsWith(".old-")) continue;
    const src = join(nm, name);
    const dest = join(tmpdir(), `rn-bun-${name}-${process.pid}-${Date.now()}`);
    console.log(`▸ quarantining leftover ${name} → ${dest}`);
    try {
      renameSync(src, dest);
      // Leave cleanup to the OS/tmp scrubber — recursive self-copies can hang `rm`.
    } catch {
      // Best-effort; install may still succeed if the dir is stuck.
    }
  }
}

/** Remove a recursive/broken plugin install that can hang `bun install` / `rm -rf`. */
function clearPluginInstall(cwd: string): void {
  quarantineOldInstallDirs(cwd);

  const pluginLink = join(cwd, "node_modules", PLUGIN_NAME);
  const st = lstatSync(pluginLink, { throwIfNoEntry: false });
  if (!st) return;

  console.log(`▸ clearing ${PLUGIN_NAME} under ${cwd}`);
  if (st.isSymbolicLink()) {
    unlinkSync(pluginLink);
    return;
  }
  // Directory that may contain a nested symlink back to the repo root
  const nested = join(pluginLink, PLUGIN_NAME);
  const nestedSt = lstatSync(nested, { throwIfNoEntry: false });
  if (nestedSt?.isSymbolicLink()) unlinkSync(nested);
  // Prefer rename-out over in-place rm on potentially recursive trees.
  const dest = join(tmpdir(), `rn-bun-plugin-${process.pid}-${Date.now()}`);
  try {
    renameSync(pluginLink, dest);
  } catch {
    rmSync(pluginLink, { recursive: true, force: true });
  }
}

function ensurePluginSymlink(cwd: string): void {
  const pluginLink = join(cwd, "node_modules", PLUGIN_NAME);
  const preload = join(ROOT, "src", "preload.ts");
  if (!existsSync(preload)) {
    throw new Error(`bootstrap-fixtures: missing plugin preload at ${preload}`);
  }

  clearPluginInstall(cwd);
  symlinkSync(ROOT, pluginLink);

  const linkedPreload = join(pluginLink, "src", "preload.ts");
  if (!existsSync(linkedPreload)) {
    throw new Error(`bootstrap-fixtures: symlink failed — ${linkedPreload} missing`);
  }
}

export async function installFrozen(label: string, cwd: string): Promise<void> {
  const pkg = join(cwd, "package.json");
  const lock = join(cwd, "bun.lock");
  if (!existsSync(pkg)) {
    throw new Error(`bootstrap-fixtures: missing package.json for ${label} at ${pkg}`);
  }
  if (!existsSync(lock)) {
    throw new Error(
      `bootstrap-fixtures: missing bun.lock for ${label}. Commit a lockfile so installs are reproducible.`,
    );
  }

  // Critical: wipe broken self-copies before install so Bun cannot recurse.
  clearPluginInstall(cwd);

  console.log(`▸ bootstrap ${label}: bun install --frozen-lockfile`);
  const proc = Bun.spawn([process.execPath, "install", "--frozen-lockfile"], {
    cwd,
    stdout: "inherit",
    stderr: "inherit",
    env: { ...process.env, HUSKY: "0" },
  });
  const code = await proc.exited;
  if (code !== 0) {
    throw new Error(`bootstrap-fixtures: ${label} install failed (exit ${code})`);
  }
  if (!existsSync(join(cwd, "node_modules"))) {
    throw new Error(`bootstrap-fixtures: ${label} install left no node_modules`);
  }

  ensurePluginSymlink(cwd);
  console.log(`✓ bootstrap ${label}`);
}

async function main(): Promise<void> {
  console.log("bootstrap-fixtures: installing sandbox dependencies (frozen)");
  for (const fixture of FIXTURES) {
    await installFrozen(fixture.name, fixture.dir);
  }
  console.log("bootstrap-fixtures: OK");
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(String(err));
    process.exit(1);
  });
}
