#!/usr/bin/env bun
/**
 * bun-rn-doctor: compatibility audit and shim scaffolding.
 *
 *   bun-rn-doctor                 # audit (default)
 *   bun-rn-doctor audit [--json]  # machine-readable report
 *   bun-rn-doctor scaffold <pkg>  # write rn-bun.shims/<pkg>.ts starter
 *
 * Exit codes: 0 clean, 1 uncovered dependencies or load errors.
 */

import path from "node:path";
import { runDoctorAudit, scaffoldShim, type DoctorReport } from "../src/doctor.ts";

function renderTable(report: DoctorReport): string {
  const lines: string[] = [];
  lines.push(`bun-rn-doctor audit`);
  lines.push(`  bun ${report.bun} | platform ${report.platform} | ${report.cwd}`);
  lines.push(`  libraryMocks: ${String(report.libraryMocks)}`);
  lines.push("");

  lines.push("Compat packages:");
  if (report.packages.length === 0) lines.push("  (none discovered)");
  for (const pkg of report.packages) {
    lines.push(`  ${pkg.loaded ? "✓" : "✗"} ${pkg.name} — shims: ${pkg.shims.join(", ") || "(none)"}`);
    for (const err of pkg.errors) lines.push(`      ${err}`);
  }
  lines.push("");

  lines.push("Registry shims:");
  for (const shim of report.shims) {
    lines.push(
      `  ${shim.state === "planned" ? "✓" : "·"} [${shim.state}] ${shim.name} (${shim.provenance}) — ${shim.reason}`,
    );
  }
  lines.push("");

  lines.push("Dependency coverage:");
  if (report.coverage.length === 0) lines.push("  (no React Native / Expo ecosystem dependencies found)");
  for (const row of report.coverage) {
    lines.push(
      `  ${row.state === "uncovered" ? "✗" : "✓"} ${row.state.padEnd(9)} ${row.dependency}${row.note ? ` — ${row.note}` : ""}`,
    );
  }
  lines.push("");

  lines.push(
    `expo/jest-expo definitions: expo ${report.definitions.expoVersion ?? "absent"}, jest-expo ${report.definitions.jestExpoVersion ?? "absent"} — ${report.definitions.match ? "paired" : "MISMATCH"}`,
  );
  if (report.definitions.note) {
    lines.push(`  ${report.definitions.note}`);
  }
  lines.push("");

  if (report.uncovered.length > 0) {
    lines.push("Uncovered dependencies — add a shim with:");
    for (const dep of report.uncovered) {
      lines.push(`  bun-rn-doctor scaffold ${dep}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const [cmd = "audit", ...rest] = args;
  const cwd = process.cwd();

  if (cmd === "scaffold") {
    const pkg = rest[0];
    if (!pkg) {
      console.error("usage: bun-rn-doctor scaffold <package-name>");
      return 2;
    }
    try {
      const { path: scaffoldPath } = scaffoldShim(pkg, cwd);
      const relImport = path
        .relative(cwd, scaffoldPath)
        .replaceAll("\\", "/")
        .replace(/\.(ts|tsx)$/, "");
      console.log(`Wrote ${scaffoldPath}`);
      console.log(`Register it in rn-bun.config.ts:`);
      console.log(`  import { shim } from "./${relImport}";`);
      console.log(`  export default { compat: { shims: [shim] } };`);
      return 0;
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      return 2;
    }
  }

  if (cmd !== "audit") {
    console.error(`unknown command "${cmd}" — expected "audit" or "scaffold"`);
    return 2;
  }

  const report = runDoctorAudit(cwd);
  if (rest.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(renderTable(report));
  }
  const failed = report.uncovered.length > 0 || report.packages.some((p) => !p.loaded);
  if (failed) {
    console.log("compat audit: found gaps (exit 1)");
    return 1;
  }
  console.log("compat audit: clean");
  return 0;
}

process.exitCode = await main();
