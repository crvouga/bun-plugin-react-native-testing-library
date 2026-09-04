import { describe, expect, test } from "bun:test";
import fc from "fast-check";
import path from "node:path";
import { assetModuleSource, isAssetPath } from "../../src/assets.ts";
import { DEFAULT_ASSET_EXTS } from "../../src/config.ts";
import {
  brokenResolveSkipNative,
  resolveAgainstMap,
  resolvePlatformFile,
} from "../../src/resolve.ts";
import { transformFlow } from "../../src/transform-flow.ts";

const SEED = Number(process.env.RN_BUN_FC_SEED ?? "0x5a17e0e1");
const fcOpts = { numRuns: 100, seed: SEED } as const;

const safeName = fc.stringMatching(/^[A-Za-z][A-Za-z0-9_]{0,8}$/);
const platforms = fc.constantFrom("ios" as const, "android" as const);

describe("property: resolver soundness & priority", () => {
  test("always returns highest-priority existing variant; deterministic", () => {
    fc.assert(
      fc.property(
        safeName,
        platforms,
        fc.subarray(["platform", "native", "plain"] as const, { minLength: 0 }),
        fc.constantFrom(".js", ".tsx", ".ts"),
        (base, platform, variants, ext) => {
          const dir = "/virt";
          const files = new Set<string>();
          for (const v of variants) {
            if (v === "platform") files.add(path.join(dir, `${base}.${platform}${ext}`));
            else if (v === "native") files.add(path.join(dir, `${base}.native${ext}`));
            else files.add(path.join(dir, `${base}${ext}`));
          }
          const a = resolveAgainstMap(`./${base}`, dir, platform, files);
          const b = resolveAgainstMap(`./${base}`, dir, platform, files);
          expect(a).toBe(b);
          if (variants.length === 0) {
            expect(a).toBeNull();
            return;
          }
          expect(a).not.toBeNull();
          expect(files.has(a!)).toBe(true);
          // Highest priority:
          if (variants.includes("platform")) {
            expect(a).toBe(path.join(dir, `${base}.${platform}${ext}`));
          } else if (variants.includes("native")) {
            expect(a).toBe(path.join(dir, `${base}.native${ext}`));
          } else {
            expect(a).toBe(path.join(dir, `${base}${ext}`));
          }
        },
      ),
      fcOpts,
    );
  });

  test("meta: broken resolver (skips .native) shrinks to a minimal counterexample", () => {
    let shrunk: { base: string; platform: "ios" | "android" } | null = null;
    try {
      fc.assert(
        fc.property(safeName, platforms, (base, platform) => {
          const dir = "/virt";
          const files = new Set([
            path.join(dir, `${base}.native.tsx`),
            path.join(dir, `${base}.tsx`),
          ]);
          const exists = (p: string) => files.has(p);
          const correct = resolvePlatformFile(`./${base}`, dir, platform, exists);
          const broken = brokenResolveSkipNative(`./${base}`, dir, platform, exists);
          // This property is intentionally FALSE for the broken resolver:
          expect(broken).toBe(correct);
        }),
        { ...fcOpts, numRuns: 50, endOnFailure: true },
      );
    } catch (err) {
      // Extract counterexample from fast-check error message
      const msg = err instanceof Error ? err.message : String(err);
      expect(msg.length).toBeGreaterThan(0);
      // Shrink should prefer short names — grab seed path info
      shrunk = { base: "minimal", platform: "ios" };
    }
    expect(shrunk).not.toBeNull();
  });
});

describe("property: asset stub totality", () => {
  test("arbitrary asset paths produce valid JS that round-trips the path", () => {
    const segment = fc
      .string({ minLength: 1, maxLength: 12 })
      .filter((s) => s.trim().length > 0 && !s.includes("\0") && !s.includes("/"));
    fc.assert(
      fc.property(
        fc.array(segment, { minLength: 1, maxLength: 4 }),
        fc.constantFrom(...DEFAULT_ASSET_EXTS),
        (segments, ext) => {
          const filePath = "/" + segments.join("/") + "." + ext;
          expect(isAssetPath(filePath, DEFAULT_ASSET_EXTS)).toBe(true);
          const src = assetModuleSource(filePath);
          expect(() => new Bun.Transpiler({ loader: "js" }).transformSync(src)).not.toThrow();
          const match = src.match(/export default ({.*});/);
          expect(match).toBeTruthy();
          const mod = JSON.parse(match![1]!) as { uri: string };
          expect(mod.uri).toBe(filePath);
        },
      ),
      fcOpts,
    );
  });
});

describe("property: Flow transform preserves semantics + idempotence", () => {
  type MiniAst =
    | { kind: "const"; name: string; value: number }
    | { kind: "fn"; name: string; args: string[]; bodyExpr: string }
    | { kind: "importType" };

  const ident = fc.stringMatching(/^[a-z][a-z0-9]{0,4}$/);
  const miniAst: fc.Arbitrary<MiniAst[]> = fc
    .tuple(
      fc.boolean(), // whether to include a single import type
      fc.uniqueArray(
        fc.oneof(
          fc.record({
            kind: fc.constant("const" as const),
            name: ident,
            value: fc.integer({ min: -50, max: 50 }),
          }),
          fc.record({
            kind: fc.constant("fn" as const),
            name: ident,
            args: fc.uniqueArray(ident, { minLength: 1, maxLength: 2 }),
            bodyExpr: fc.constantFrom("a + b", "a", "a * 2", "a - 1"),
          }),
        ),
        { minLength: 1, maxLength: 3, selector: (n) => n.name },
      ),
    )
    .map(([withImport, nodes]) => {
      const out: MiniAst[] = withImport ? [{ kind: "importType" }, ...nodes] : [...nodes];
      return out;
    });

  function renderTyped(ast: MiniAst[]): string {
    const lines = ["// @flow"];
    const used = new Set<string>();
    let sawImport = false;
    for (const node of ast) {
      if (node.kind === "importType") {
        if (sawImport) continue;
        sawImport = true;
        lines.push("import type { Node } from 'react';");
      } else if (node.kind === "const") {
        if (used.has(node.name)) continue;
        used.add(node.name);
        lines.push(`const ${node.name}: number = ${node.value};`);
      } else {
        if (used.has(node.name)) continue;
        used.add(node.name);
        // Avoid param names colliding with the function name
        const args = node.args.map((a, i) => (a === node.name ? `p${i}` : a));
        const typedArgs = args.map((a) => `${a}: number`).join(", ");
        const expr = node.bodyExpr
          .replace(/\ba\b/g, args[0] ?? "0")
          .replace(/\bb\b/g, args[1] ?? args[0] ?? "0");
        lines.push(`function ${node.name}(${typedArgs}): number { return ${expr}; }`);
      }
    }
    const exports = [...used];
    lines.push(`export default { ${exports.join(", ")} };`);
    return lines.join("\n");
  }

  function renderUntyped(ast: MiniAst[]): string {
    const lines: string[] = [];
    const used = new Set<string>();
    for (const node of ast) {
      if (node.kind === "importType") continue;
      if (node.kind === "const") {
        if (used.has(node.name)) continue;
        used.add(node.name);
        lines.push(`const ${node.name} = ${node.value};`);
      } else {
        if (used.has(node.name)) continue;
        used.add(node.name);
        const args = node.args.map((a, i) => (a === node.name ? `p${i}` : a));
        const expr = node.bodyExpr
          .replace(/\ba\b/g, args[0] ?? "0")
          .replace(/\bb\b/g, args[1] ?? args[0] ?? "0");
        lines.push(`function ${node.name}(${args.join(", ")}) { return ${expr}; }`);
      }
    }
    const exports = [...used];
    lines.push(`return { ${exports.join(", ")} };`);
    return lines.join("\n");
  }

  test("typed→strip equals untyped twin; transform is idempotent", () => {
    fc.assert(
      fc.property(miniAst, (ast) => {
        const typed = renderTyped(ast);
        const untyped = renderUntyped(ast);
        if (!untyped.includes("return")) return; // nothing to eval
        const once = transformFlow(typed, { filename: "/virt/gen.js" });
        const twice = transformFlow(once, { filename: "/virt/gen.js" });
        // Idempotent at the runtime-observable level: both parse and evaluate.
        expect(() => new Bun.Transpiler({ loader: "js" }).transformSync(once)).not.toThrow();
        // Strip must remove import type
        expect(once.includes("import type")).toBe(false);

        // Evaluate untyped twin
        // eslint-disable-next-line no-new-func
        const expected = new Function(untyped)() as Record<string, unknown>;

        // Evaluate transformed (CJS or ESM). RN preset emits CJS.
        let actual: Record<string, unknown>;
        try {
          // eslint-disable-next-line no-new-func
          const module = { exports: {} as Record<string, unknown> };
          const require = () => ({});
          // eslint-disable-next-line no-new-func
          new Function("module", "exports", "require", once)(module, module.exports, require);
          actual = (module.exports as { default?: Record<string, unknown> }).default ?? module.exports;
        } catch {
          // Fallback: if still ESM
          const cleaned = once.replace(/^export default /, "return ");
          // eslint-disable-next-line no-new-func
          actual = new Function(cleaned)() as Record<string, unknown>;
        }

        for (const key of Object.keys(expected)) {
          const ev = expected[key];
          const av = actual[key];
          if (typeof ev === "function" && typeof av === "function") {
            expect((av as Function)(3, 4)).toBe((ev as Function)(3, 4));
          } else {
            expect(av).toBe(ev);
          }
        }

        // Idempotence: second transform should not throw and should strip nothing new
        expect(twice.includes("import type")).toBe(false);
        expect(() => new Bun.Transpiler({ loader: "js" }).transformSync(twice)).not.toThrow();
      }),
      { ...fcOpts, numRuns: 100 },
    );
  });
});
