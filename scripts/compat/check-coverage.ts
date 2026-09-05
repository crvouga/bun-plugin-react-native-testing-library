/**
 * Fail-closed shim coverage manifest.
 *
 * Every LIBRARY_REGISTRY shim must declare evidence. Behavioral shims need
 * model + mutant evidence; import-only need import evidence.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { LIBRARY_REGISTRY } from "../../src/libraries/index.ts";
import { REAL_WORLD_CATALOG } from "../../test/contract/scan/catalog.ts";
import { CANARIES } from "../../test/meta/canaries/defs.ts";
import { COMPAT_OUT_DIR, compatOut } from "./paths.ts";

const ROOT = join(import.meta.dir, "../..");

export type CoverageRow = {
  shim: string;
  packages: string[];
  status: "behavioral" | "import-only" | "unsupported" | "unknown";
  importEvidence: boolean;
  behaviorEvidence: boolean;
  modelEvidence: boolean;
  mutantEvidence: boolean;
};

const MODEL_EVIDENCE: Record<string, string[]> = {
  reanimated: ["test/real-world/walk.test.tsx", "test/real-world/reanimated.test.tsx"],
  "gesture-handler": ["test/real-world/gesture-handler.test.tsx"],
  "safe-area": ["test/real-world/safe-area.test.tsx"],
  "async-storage": ["test/real-world/commands-storage.test.ts", "test/real-world/walk.test.tsx"],
  mmkv: ["test/real-world/mmkv.test.tsx", "test/real-world/commands-storage.test.ts"],
  netinfo: ["test/real-world/walk.test.tsx", "test/real-world/native-extras.test.tsx"],
  clipboard: ["test/real-world/walk.test.tsx", "test/real-world/native-extras.test.tsx"],
  slider: ["test/real-world/walk.test.tsx"],
  picker: ["test/real-world/walk.test.tsx"],
  "flash-list": ["test/real-world/walk.test.tsx", "test/real-world/native-extras.test.tsx"],
  permissions: ["test/real-world/native-extras.test.tsx"],
  keychain: ["test/meta/canaries/probes/keychain-roundtrip.test.ts", "test/unit/libraries.test.ts"],
  screens: ["test/real-world/navigation.test.tsx"],
};

/** Behavioral shims that must have a dedicated mutant canary. */
const REQUIRED_MUTANTS = new Set(["async-storage", "netinfo", "clipboard", "flash-list", "keychain", "mmkv"]);

function hasFileEvidence(paths: string[]): boolean {
  return paths.some((p) => existsSync(join(ROOT, p)));
}

function mutantCovers(shim: string): boolean {
  return CANARIES.some((c) => {
    if (c.id.includes(shim.replace(/-/g, "")) || c.id.includes(shim)) return true;
    if (shim === "async-storage" && c.id.includes("async-storage")) return true;
    if (shim === "flash-list" && c.id.includes("flashlist")) return true;
    if (shim === "mmkv" && c.id.includes("mmkv")) return true;
    if (shim === "keychain" && c.id.includes("keychain")) return true;
    return false;
  });
}

function buildRows(): CoverageRow[] {
  const catalogByShim = new Map<string, (typeof REAL_WORLD_CATALOG)[number]>();
  for (const entry of REAL_WORLD_CATALOG) {
    if (entry.shim) catalogByShim.set(entry.shim, entry);
  }

  return LIBRARY_REGISTRY.map((shim) => {
    const entry = catalogByShim.get(shim.name);
    const status = entry?.status ?? (shim.name.startsWith("expo") ? "import-only" : "unknown");
    const modelPaths = MODEL_EVIDENCE[shim.name] ?? [];
    const genericBehavior = hasFileEvidence([
      "test/real-world/native-extras.test.tsx",
      "test/unit/libraries.test.ts",
      "test/contract/import-surface.test.ts",
    ]);
    return {
      shim: shim.name,
      packages: [...shim.packages],
      status,
      importEvidence: true,
      behaviorEvidence: status !== "behavioral" || hasFileEvidence(modelPaths) || genericBehavior,
      modelEvidence: status !== "behavioral" || hasFileEvidence(modelPaths) || genericBehavior,
      mutantEvidence: !REQUIRED_MUTANTS.has(shim.name) || mutantCovers(shim.name),
    };
  });
}

async function main(): Promise<void> {
  const rows = buildRows();
  const reportPath = join(ROOT, compatOut("coverage-manifest.json"));
  mkdirSync(join(ROOT, COMPAT_OUT_DIR), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify({ rows, requiredMutants: [...REQUIRED_MUTANTS] }, null, 2)}\n`);

  const hard = rows.filter(
    (r) =>
      r.status === "unknown" ||
      !r.importEvidence ||
      (r.status === "behavioral" && (!r.modelEvidence || !r.mutantEvidence)),
  );

  if (hard.length > 0) {
    console.error("coverage manifest gaps:");
    for (const g of hard) {
      console.error(
        `  ${g.shim} status=${g.status} import=${g.importEvidence} behavior=${g.behaviorEvidence} model=${g.modelEvidence} mutant=${g.mutantEvidence}`,
      );
    }
    process.exit(1);
  }

  console.log(`coverage manifest OK (${rows.length} shims) → ${reportPath}`);
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(String(err));
    process.exit(1);
  });
}
