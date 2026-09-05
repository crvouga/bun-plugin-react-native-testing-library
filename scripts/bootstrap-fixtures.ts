/**
 * Fail-closed fixture bootstrap: install sandbox deps with frozen lockfiles.
 *
 * Used by `bun check` before inventory / integration / walk stages.
 * Missing lockfiles or install failures are hard errors — never silent skips.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");

export const FIXTURES = [
  { name: "real-world", dir: join(ROOT, "test", "real-world") },
  { name: "real-world-expo", dir: join(ROOT, "test", "real-world-expo") },
] as const;

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
