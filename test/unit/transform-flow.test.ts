import { describe, expect, mock, test } from "bun:test";
import { createTransformCache, transformFlow } from "../../src/transform-flow.ts";

const FLOW_FIXTURE = `
// @flow
import type { Node } from 'react';
opaque type ID = string;

type Props = { name: string, count: number };

export function greet(props: Props): string {
  const id: ID = props.name;
  return id + ':' + String(props.count + 1);
}

export const add = (a: number, b: number): number => a + b;
`;

describe("transform-flow.ts", () => {
  test("strips Flow so Bun.Transpiler accepts the output", () => {
    const out = transformFlow(FLOW_FIXTURE, { filename: "/virt/greet.js" });
    expect(out.includes("opaque type")).toBe(false);
    expect(out.includes("import type")).toBe(false);
    // Bun should accept it
    expect(() => new Bun.Transpiler({ loader: "js" }).transformSync(out)).not.toThrow();
    // Runtime semantics preserved (RN preset emits CJS)
    const module = { exports: {} as Record<string, unknown> };
    // eslint-disable-next-line no-new-func
    new Function("module", "exports", "require", out)(module, module.exports, (id: string) => {
      if (id === "react") return {};
      throw new Error(`unexpected require: ${id}`);
    });
    const fn = module.exports as {
      greet?: (p: { name: string; count: number }) => string;
      add?: (a: number, b: number) => number;
    };
    // Named exports may be on module.exports directly after CJS transform
    const greet = fn.greet ?? (module.exports as { greet: (p: { name: string; count: number }) => string }).greet;
    const add = fn.add ?? (module.exports as { add: (a: number, b: number) => number }).add;
    expect(typeof add).toBe("function");
    expect(typeof greet).toBe("function");
    expect(add!(2, 3)).toBe(5);
    expect(greet!({ name: "a", count: 1 })).toBe("a:2");
  });

  test("cache: same (path, mtime) invokes transform exactly once", () => {
    const spy = mock((code: string) => `/*transformed*/${code}`);
    const cache = createTransformCache({
      cacheDir: null,
      transform: spy as unknown as (code: string, opts: { filename: string }) => string,
    });

    const code = "const x: number = 1;";
    const opts = { filename: "/virt/a.js", mtimeMs: 100, size: code.length };
    const a = cache.transform(code, opts);
    const b = cache.transform(code, opts);
    expect(a.code).toBe(b.code);
    expect(a.cacheHit).toBe(false);
    expect(b.cacheHit).toBe(true);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(cache.stats()).toEqual({ hits: 1, misses: 1 });
  });

  test("cache miss on mtime change", () => {
    const spy = mock((code: string) => code);
    const cache = createTransformCache({
      cacheDir: null,
      transform: spy as unknown as (code: string, opts: { filename: string }) => string,
    });
    const code = "const x = 1;";
    cache.transform(code, { filename: "/virt/b.js", mtimeMs: 1, size: 10 });
    cache.transform(code, { filename: "/virt/b.js", mtimeMs: 2, size: 10 });
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
