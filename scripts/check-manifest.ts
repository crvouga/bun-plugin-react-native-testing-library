/**
 * Canonical release-gate stage list.
 *
 * Meta-tests and `scripts/check.ts` share this so deleting/bypassing a stage
 * fails `bun check`. Stages must not pass by logging "skip".
 */

export type CheckStage = {
  /** Stable id used in the release report. */
  id: string;
  /** Human label printed during the run. */
  label: string;
  /** argv relative to repo root (first token is the executable). */
  argv: readonly string[];
  /** Optional env overlay for this stage. */
  env?: Record<string, string>;
};

/** Every locally executable release stage, in order. */
export const CHECK_STAGES: readonly CheckStage[] = [
  {
    id: "bootstrap-fixtures",
    label: "Bootstrap fixtures (frozen sandbox installs)",
    argv: ["bun", "run", "scripts/bootstrap-fixtures.ts"],
  },
  {
    id: "format",
    label: "Format check",
    argv: ["bun", "run", "format:check"],
  },
  {
    id: "lint",
    label: "Lint",
    argv: ["bun", "run", "lint"],
  },
  {
    id: "typecheck",
    label: "Typecheck",
    argv: ["bun", "run", "typecheck"],
  },
  {
    id: "verify-package",
    label: "Verify package / tarball",
    argv: ["bun", "run", "verify-package"],
  },
  {
    id: "compat-matrix",
    label: "npm-pack clean-consumer matrix",
    argv: ["bun", "run", "scripts/compat/run-matrix.ts"],
  },
  {
    id: "differential-oracle",
    label: "Differential oracle (Bun vs official RN Jest)",
    argv: ["bun", "run", "scripts/compat/run-oracle.ts"],
  },
  {
    id: "tests",
    label: "Contract / property / unit / integration / meta tests",
    argv: ["bun", "test", "--bail"],
    env: { RN_BUN_RELEASE_GATE: "1" },
  },
  {
    id: "walks",
    label: "Model walks (multi-seed + soak)",
    argv: ["bun", "run", "scripts/compat/run-walks.ts"],
    env: { RN_BUN_RELEASE_GATE: "1" },
  },
  {
    id: "coverage-manifest",
    label: "Shim coverage manifest",
    argv: ["bun", "run", "scripts/compat/check-coverage.ts"],
  },
  {
    id: "canaries",
    label: "Mutation canaries (temp copies)",
    argv: ["bun", "run", "scripts/run-canaries.ts"],
    env: { RN_BUN_CANARY_TEMP: "1" },
  },
];

export const RELEASE_READY_SENTINEL = "RELEASE READY: bun check passed";

/** Ephemeral — under `.compat-out/` (gitignored). Never commit gate reports. */
export const REPORT_PATH = ".compat-out/release-report.json";
