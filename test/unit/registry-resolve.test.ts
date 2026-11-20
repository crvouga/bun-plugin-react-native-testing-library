/**
 * Registry resolution: ordered three-source merge, conflict and override
 * semantics, disable list. Pure planning — no mock.module side effects.
 */

import { describe, expect, test } from "bun:test";
import type { LibraryShim } from "../../src/libraries/helpers.ts";
import { resolveRegistry } from "../../src/libraries/index.ts";
import { resolveConfig } from "../../src/config.ts";

function fakeShim(name: string, opts: Partial<LibraryShim> = {}): LibraryShim {
  return {
    name,
    packages: opts.packages ?? ["react"],
    register: () => {},
    ...opts,
  };
}

const alwaysAvailable = ["react"];

describe("registry: resolveRegistry merge semantics", () => {
  test("orders builtins by ascending priority, then package shims, then local shims", () => {
    const builtins = [
      fakeShim("late-builtin", { priority: 200, packages: alwaysAvailable }),
      fakeShim("early-builtin", { priority: 10, packages: alwaysAvailable }),
      fakeShim("default-builtin", { packages: alwaysAvailable }),
    ];
    const packageShims = [fakeShim("pkg-shim", { provenance: "package" as const, packages: ["react"] })];
    const localShims = [fakeShim("local-shim", { provenance: "local" as const, packages: ["test-renderer"] })];

    const plan = resolveRegistry(resolveConfig(), { builtins, packageShims, localShims });
    expect(plan.ordered.map((s) => s.name)).toEqual([
      "early-builtin",
      "default-builtin",
      "late-builtin",
      "pkg-shim",
      "local-shim",
    ]);
  });

  test("shims with partially-resolving packages are planned as unavailable, without error", () => {
    const shims = [
      fakeShim("needs-real", { packages: ["react"] }),
      fakeShim("needs-missing", { packages: ["react", "definitely-not-a-package-xyz"] }),
    ];
    const plan = resolveRegistry(resolveConfig(), { builtins: shims });
    expect(plan.ordered.map((s) => s.name)).toEqual(["needs-real"]);
    expect(plan.unavailable).toEqual(["needs-missing"]);
  });

  test("disable list removes named shims from the plan and reports them", () => {
    const shims = [
      fakeShim("keep-me", { packages: alwaysAvailable }),
      fakeShim("drop-me", { packages: alwaysAvailable }),
    ];
    const plan = resolveRegistry(resolveConfig({ disable: ["drop-me"] }), { builtins: shims });
    expect(plan.ordered.map((s) => s.name)).toEqual(["keep-me"]);
    expect(plan.disabled).toEqual(["drop-me"]);
  });

  test("two active shims claiming the same target throw, naming both shims", () => {
    const shims = [
      fakeShim("first-claim", { packages: alwaysAvailable, targets: ["react-native-reanimated"] }),
      fakeShim("second-claim", { packages: alwaysAvailable, targets: ["react-native-reanimated"] }),
    ];
    let message = "";
    try {
      resolveRegistry(resolveConfig(), { builtins: shims });
    } catch (err) {
      message = err instanceof Error ? err.message : String(err);
    }
    expect(message).toMatch(/Shim conflict/);
    for (const part of ["first-claim", "second-claim", "react-native-reanimated"]) {
      expect(message).toContain(part);
    }
  });

  test("later shim with override:true replaces the earlier claim and is reported", () => {
    const shims = [
      fakeShim("base-shim", { packages: alwaysAvailable, targets: ["react-native-reanimated"] }),
      fakeShim("custom-shim", {
        provenance: "local" as const,
        packages: alwaysAvailable,
        targets: ["react-native-reanimated"],
        override: true,
      }),
    ];
    const plan = resolveRegistry(resolveConfig(), { builtins: [shims[0]], localShims: [shims[1]] });
    expect(plan.ordered.map((s) => s.name)).toEqual(["base-shim", "custom-shim"]);
    expect(plan.overridden).toEqual([{ target: "react-native-reanimated", winner: "custom-shim", loser: "base-shim" }]);
    expect(plan.conflicts).toEqual([]);
  });

  test("non-builtin shims claim their activation packages when no explicit targets are declared", () => {
    const shims = [
      fakeShim("pkg-a", { provenance: "package" as const, packages: ["react"] }),
      fakeShim("local-b", { provenance: "local" as const, packages: ["react"] }),
    ];
    expect(() => resolveRegistry(resolveConfig(), { packageShims: [shims[0]], localShims: [shims[1]] })).toThrow(
      /Shim conflict[\s\S]*react/,
    );
  });

  test("builtins without declared targets are gap-fillers: they never raise conflicts", () => {
    const shims = [
      fakeShim("gap-filler", { packages: ["react"] }),
      fakeShim("local-claims-react", { provenance: "local" as const, packages: ["react"], targets: ["some/module"] }),
    ];
    const plan = resolveRegistry(resolveConfig(), { builtins: [shims[0]], localShims: [shims[1]] });
    expect(plan.ordered).toHaveLength(2);
    expect(plan.conflicts).toEqual([]);
  });

  test("libraryMocks name filter still applies to non-builtin sources", () => {
    const shims = [
      fakeShim("wanted", { provenance: "local" as const, packages: alwaysAvailable }),
      fakeShim("unwanted", { provenance: "local" as const, packages: alwaysAvailable }),
    ];
    const plan = resolveRegistry(resolveConfig({ libraryMocks: ["wanted"] }), { localShims: shims });
    expect(plan.ordered.map((s) => s.name)).toEqual(["wanted"]);
    expect(plan.disabled).toEqual([]);
  });
});
