import { describe, expect, test } from "bun:test";
import path from "node:path";
import {
  brokenResolveSkipNative,
  candidatePaths,
  resolveAgainstMap,
  resolvePlatformFile,
} from "../../src/resolve.ts";

const DIR = "/proj/src";

function mapOf(...files: string[]): Set<string> {
  return new Set(files.map((f) => (path.isAbsolute(f) ? f : path.join(DIR, f))));
}

describe("resolve.ts Metro platform resolution", () => {
  test("ios: prefers .ios over .native over plain", () => {
    const files = mapOf("Foo.ios.tsx", "Foo.native.tsx", "Foo.tsx");
    expect(resolveAgainstMap("./Foo", DIR, "ios", files)).toBe(path.join(DIR, "Foo.ios.tsx"));
  });

  test("ios: falls back to .native when .ios missing", () => {
    const files = mapOf("Foo.native.tsx", "Foo.tsx");
    expect(resolveAgainstMap("./Foo", DIR, "ios", files)).toBe(path.join(DIR, "Foo.native.tsx"));
  });

  test("ios: falls back to plain when platform+native missing", () => {
    const files = mapOf("Foo.tsx");
    expect(resolveAgainstMap("./Foo", DIR, "ios", files)).toBe(path.join(DIR, "Foo.tsx"));
  });

  test("android: prefers .android over .native over plain", () => {
    const files = mapOf("Foo.android.js", "Foo.native.js", "Foo.js");
    expect(resolveAgainstMap("./Foo", DIR, "android", files)).toBe(
      path.join(DIR, "Foo.android.js"),
    );
  });

  test("extension priority within a platform suffix (.js before later? — .js first in list)", () => {
    const files = mapOf("Foo.ios.js", "Foo.ios.tsx");
    expect(resolveAgainstMap("./Foo", DIR, "ios", files)).toBe(path.join(DIR, "Foo.ios.js"));
  });

  test("index resolution", () => {
    const files = mapOf("widgets/index.ios.ts", "widgets/index.ts");
    expect(resolveAgainstMap("./widgets", DIR, "ios", files)).toBe(
      path.join(DIR, "widgets/index.ios.ts"),
    );
  });

  test("returns null when nothing exists", () => {
    expect(resolveAgainstMap("./Missing", DIR, "ios", new Set())).toBeNull();
  });

  test("ignores bare (non-relative) specifiers", () => {
    expect(candidatePaths("react-native", DIR, "ios")).toEqual([]);
    expect(resolvePlatformFile("lodash", DIR, "ios", () => true)).toBeNull();
  });

  test("broken resolver skips .native (meta-test fixture)", () => {
    const files = mapOf("Foo.native.tsx", "Foo.tsx");
    const exists = (p: string) => files.has(p);
    const broken = brokenResolveSkipNative("./Foo", DIR, "ios", exists);
    const correct = resolvePlatformFile("./Foo", DIR, "ios", exists);
    expect(correct).toBe(path.join(DIR, "Foo.native.tsx"));
    expect(broken).toBe(path.join(DIR, "Foo.tsx"));
  });
});
