/**
 * Shared cache-invalidation stamp for integration sandboxes that install a
 * copy of the plugin via `file:`. Bun copies file: dependencies into
 * node_modules, so any source change (new commit or dirty tree) must produce
 * a new stamp or the sandbox keeps serving a stale copy.
 */

import path from "node:path";
import { mkdirSync, rmSync } from "node:fs";

const REPO_ROOT = path.resolve(import.meta.dir, "../..");

export function pluginSourceStamp(): string {
  const rev = Bun.spawnSync(["git", "-C", REPO_ROOT, "rev-parse", "HEAD"]);
  const head = rev.stdout.toString().trim();
  const status = Bun.spawnSync(["git", "-C", REPO_ROOT, "status", "--porcelain", "--", "src", "package.json"]);
  return `${head}:${status.stdout.toString().trim() === "" ? "clean" : "dirty"}`;
}

export { REPO_ROOT };

const INSTALL_LOCK_DIR = path.join(REPO_ROOT, ".virt-rn-fixture", ".install-lock");

/**
 * Serialize sandbox `bun install` runs. Concurrent installs that copy the same
 * `file:` dependency from one source tree have raced into partial copies;
 * installs are infrequent (stamp-gated) so a single lock is enough.
 */
export async function withInstallLock<T>(fn: () => Promise<T>): Promise<T> {
  const deadline = Date.now() + 120_000;
  for (;;) {
    try {
      mkdirSync(INSTALL_LOCK_DIR);
      break;
    } catch {
      if (Date.now() > deadline) {
        // Steal a stale lock rather than hang the suite on a crashed run.
        rmSync(INSTALL_LOCK_DIR, { recursive: true, force: true });
        continue;
      }
      await new Promise((r) => setTimeout(r, 150));
    }
  }
  try {
    return await fn();
  } finally {
    rmSync(INSTALL_LOCK_DIR, { recursive: true, force: true });
  }
}
