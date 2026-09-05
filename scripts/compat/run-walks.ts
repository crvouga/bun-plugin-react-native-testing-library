/**
 * Multi-seed + soak model walks for the release gate.
 */
import { join } from "node:path";

const ROOT = join(import.meta.dir, "../..");

const SEEDS = [0x5a17e0e1, 0x51eed, 0xc0ffee, 0x1234567];

async function run(label: string, argv: string[], env: Record<string, string>): Promise<void> {
  console.log(`▸ ${label}`);
  const proc = Bun.spawn(argv, {
    cwd: ROOT,
    stdout: "inherit",
    stderr: "inherit",
    env: { ...process.env, HUSKY: "0", RN_BUN_RELEASE_GATE: "1", ...env },
  });
  const code = await proc.exited;
  if (code !== 0) {
    throw new Error(`walk failed: ${label} (exit ${code})`);
  }
}

async function main(): Promise<void> {
  for (const seed of SEEDS) {
    await run(`root walk seed=${seed}`, ["bun", "test", "--bail", "test/property/walk.test.tsx"], {
      RN_BUN_FC_SEED: String(seed),
      RN_BUN_FC_RUNS: process.env.RN_BUN_WALK_RUNS ?? "24",
    });
  }

  await run(
    "sandbox walks",
    [
      "bun",
      "test",
      "--bail",
      "--cwd",
      "test/real-world",
      "walk.test.tsx",
      "commands-storage.test.ts",
      "navigation.test.tsx",
    ],
    {
      RN_BUN_FC_SEED: "0x5a17e0e1",
      RN_BUN_FC_RUNS: process.env.RN_BUN_WALK_RUNS ?? "20",
    },
  );

  // Deeper bounded soak (still release-blocking, not unbounded)
  await run("soak walk", ["bun", "test", "--bail", "test/property/walk.test.tsx"], {
    RN_BUN_FC_SEED: "0x50a7",
    RN_BUN_FC_RUNS: process.env.RN_BUN_SOAK_RUNS ?? "40",
  });

  console.log("model walks OK");
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(String(err));
    process.exit(1);
  });
}
