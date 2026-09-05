/**
 * npm-pack clean-consumer matrix.
 *
 * Packs this package, installs isolated consumers for each matrix row, and
 * runs smoke (full) or import (light) probes. Failures are hard errors —
 * never skipped. Narrow peers/README if a declared combination cannot pass.
 */
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ALL_ROWS, type MatrixRow } from "./matrix.ts";

const ROOT = join(import.meta.dir, "../..");
const REPORT = join(ROOT, "compat", "matrix-report.json");

type RowResult = {
  id: string;
  kind: MatrixRow["kind"];
  ok: boolean;
  seconds: number;
  detail: string;
};

async function run(cmd: string[], cwd: string, env?: Record<string, string>): Promise<{ code: number; out: string }> {
  const proc = Bun.spawn(cmd, {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, HUSKY: "0", ...env },
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { code, out: `${stdout}\n${stderr}` };
}

async function packPlugin(work: string): Promise<string> {
  // Prefer bun pack (no npm required); fall back to npm pack --json.
  let pack = await run([process.execPath, "pm", "pack"], ROOT);
  if (pack.code !== 0) {
    pack = await run(["npm", "pack", "--json"], ROOT);
  }
  if (pack.code !== 0) throw new Error(`pack failed:\n${pack.out}`);

  let tgzName: string | null = null;
  const match = pack.out.match(/([\w.@+-]+\.tgz)/);
  tgzName = match?.[1] ?? null;
  if (!tgzName) {
    try {
      const parsed = JSON.parse(pack.out.trim().split("\n").filter(Boolean).at(-1)!) as
        | Array<{ filename?: string }>
        | { filename?: string };
      const first = Array.isArray(parsed) ? parsed[0] : parsed;
      tgzName = first?.filename ?? null;
    } catch {
      // fall through
    }
  }
  if (!tgzName) throw new Error(`pack did not produce a tarball:\n${pack.out}`);
  const src = join(ROOT, tgzName);
  const dest = join(work, tgzName);
  if (!existsSync(src)) throw new Error(`packed tarball missing: ${src}`);
  cpSync(src, dest);
  rmSync(src);
  return dest;
}

function writeConsumer(dir: string, row: MatrixRow, tarball: string): void {
  mkdirSync(dir, { recursive: true });
  const pkg = {
    name: `rn-bun-matrix-${row.id}`,
    private: true,
    type: "module",
    dependencies: {
      "bun-plugin-react-native-testing-library": `file:${tarball}`,
      "@testing-library/react-native": row.rntl,
      react: row.react,
      "react-native": row.reactNative,
      "test-renderer": row.testRenderer,
    },
  };
  writeFileSync(join(dir, "package.json"), `${JSON.stringify(pkg, null, 2)}\n`);
  writeFileSync(join(dir, "bunfig.toml"), `[test]\npreload = ["bun-plugin-react-native-testing-library/preload"]\n`);

  if (row.kind === "full") {
    writeFileSync(
      join(dir, "smoke.test.tsx"),
      `import { test, expect } from "bun:test";
import { Text, Pressable, View } from "react-native";
import { render, fireEvent } from "@testing-library/react-native";

test("matrix smoke render/press", async () => {
  let n = 0;
  const screen = await render(
    <View testID="root">
      <Pressable testID="btn" accessibilityRole="button" onPress={() => { n += 1; }}>
        <Text testID="label">{n}</Text>
      </Pressable>
    </View>,
  );
  expect(screen.getByTestId("root")).toBeTruthy();
  fireEvent.press(screen.getByTestId("btn"));
  expect(n).toBe(1);
  await screen.unmount();
});
`,
    );
  } else {
    // Top-level imports only — RNTL registers beforeAll() at module load;
    // dynamic import() inside test() makes Bun throw "Cannot call beforeAll() inside a test".
    writeFileSync(
      join(dir, "import.test.ts"),
      `import { test, expect } from "bun:test";
import * as plugin from "bun-plugin-react-native-testing-library";
import { View } from "react-native";
import { render } from "@testing-library/react-native";

test("matrix light import surface", () => {
  const factory = plugin.createReactNativePlugin ?? plugin.default;
  expect(typeof factory).toBe("function");
  expect(View).toBeTruthy();
  expect(typeof render).toBe("function");
});
`,
    );
  }
}

async function runRow(row: MatrixRow, tarball: string, parent: string): Promise<RowResult> {
  const started = performance.now();
  const dir = join(parent, row.id);
  writeConsumer(dir, row, tarball);
  const install = await run([process.execPath, "install"], dir, { RN_BUN_PLATFORM: row.platform });
  if (install.code !== 0) {
    return {
      id: row.id,
      kind: row.kind,
      ok: false,
      seconds: (performance.now() - started) / 1000,
      detail: `install failed:\n${install.out.slice(-3000)}`,
    };
  }
  const test = await run([process.execPath, "test", "--bail"], dir, { RN_BUN_PLATFORM: row.platform });
  const ok = test.code === 0;
  return {
    id: row.id,
    kind: row.kind,
    ok,
    seconds: (performance.now() - started) / 1000,
    detail: ok ? "ok" : test.out.slice(-3000),
  };
}

async function main(): Promise<void> {
  console.log(`compat matrix: ${ALL_ROWS.length} rows (platform=${process.platform}, bun=${Bun.version})`);
  const work = mkdtempSync(join(tmpdir(), "rn-bun-matrix-"));
  const results: RowResult[] = [];
  try {
    const tarball = await packPlugin(work);
    console.log(`packed ${tarball}`);
    for (const row of ALL_ROWS) {
      process.stdout.write(`▸ ${row.id} (${row.kind})… `);
      const result = await runRow(row, tarball, work);
      results.push(result);
      console.log(result.ok ? `ok (${result.seconds.toFixed(1)}s)` : `FAIL (${result.seconds.toFixed(1)}s)`);
      if (!result.ok) {
        console.error(result.detail);
      }
    }
  } finally {
    // keep workdir on failure for debugging when RN_BUN_MATRIX_KEEP=1
    if (process.env.RN_BUN_MATRIX_KEEP !== "1") {
      rmSync(work, { recursive: true, force: true });
    } else {
      console.log(`kept ${work}`);
    }
  }

  mkdirSync(join(ROOT, "compat"), { recursive: true });
  writeFileSync(
    REPORT,
    `${JSON.stringify(
      {
        ok: results.every((r) => r.ok),
        bun: Bun.version,
        platform: process.platform,
        rows: results,
      },
      null,
      2,
    )}\n`,
  );

  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    console.error(`compat matrix FAILED: ${failed.map((f) => f.id).join(", ")}`);
    console.error("Narrow package.json peer ranges / README claims if a row is unsupportable.");
    process.exit(1);
  }
  console.log(`compat matrix OK (${results.length} rows) → ${REPORT}`);
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(String(err));
    process.exit(1);
  });
}
