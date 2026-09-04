/**
 * Property: RNTL query families × variants vs an a11y model tree.
 */

import { describe, expect, test } from "bun:test";
import type * as React from "react";
import { Pressable, Switch, Text, TextInput, View } from "react-native";
import {
  cleanup,
  configure,
  getDefaultNormalizer,
  isHiddenFromAccessibility,
  render,
  resetToDefaults,
  within,
} from "@testing-library/react-native";
import * as fc from "fast-check";
import { fcRuns } from "../fc-opts.ts";

type Leaf =
  | {
      kind: "button";
      testID: string;
      label: string;
      hint?: string;
      disabled: boolean;
      selected: boolean;
      busy: boolean;
      expanded: boolean;
    }
  | { kind: "text"; testID: string; value: string }
  | { kind: "input"; testID: string; value: string; placeholder: string; label: string }
  | { kind: "switch"; testID: string; label: string; checked: boolean; disabled: boolean }
  | { kind: "box"; testID: string; label: string; hidden: boolean };

type Model = { rootId: string; children: Leaf[] };

const idArb = fc.integer({ min: 1, max: 999 }).map((n) => `q-${n}`);
const word = fc.stringMatching(/^[A-Za-z][A-Za-z0-9]{0,8}$/);

const leafArb: fc.Arbitrary<Leaf> = fc.oneof(
  fc
    .record({
      testID: idArb,
      label: word,
      hint: fc.option(word, { nil: undefined }),
      disabled: fc.boolean(),
      selected: fc.boolean(),
      busy: fc.boolean(),
      expanded: fc.boolean(),
    })
    .map((r) => ({ kind: "button" as const, ...r })),
  fc.record({ testID: idArb, value: word }).map((r) => ({ kind: "text" as const, ...r })),
  fc
    .record({ testID: idArb, value: word, placeholder: word, label: word })
    .map((r) => ({ kind: "input" as const, ...r })),
  fc
    .record({ testID: idArb, label: word, checked: fc.boolean(), disabled: fc.boolean() })
    .map((r) => ({ kind: "switch" as const, ...r })),
  fc.record({ testID: idArb, label: word, hidden: fc.boolean() }).map((r) => ({ kind: "box" as const, ...r })),
);

function dedupe(model: Model): Model {
  const seen = new Set<string>();
  const uniq = (id: string) => {
    let x = id;
    let i = 0;
    while (seen.has(x)) x = `${id}-${++i}`;
    seen.add(x);
    return x;
  };
  seen.add(model.rootId);
  return {
    rootId: model.rootId,
    children: model.children.map((c) => ({ ...c, testID: uniq(c.testID) })),
  };
}

function toElement(model: Model): React.ReactElement {
  return (
    <View testID={model.rootId} accessibilityLabel="root">
      {model.children.map((c) => {
        switch (c.kind) {
          case "button":
            return (
              <Pressable
                key={c.testID}
                testID={c.testID}
                accessibilityRole="button"
                accessibilityLabel={c.label}
                accessibilityHint={c.hint}
                accessibilityState={{
                  disabled: c.disabled,
                  selected: c.selected,
                  busy: c.busy,
                  expanded: c.expanded,
                }}
                disabled={c.disabled}
                accessible
                onPress={() => {}}
              >
                <Text>{c.label}</Text>
              </Pressable>
            );
          case "text":
            return (
              <Text key={c.testID} testID={c.testID}>
                {c.value}
              </Text>
            );
          case "input":
            return (
              <TextInput
                key={c.testID}
                testID={c.testID}
                value={c.value}
                placeholder={c.placeholder}
                accessibilityLabel={c.label}
                onChangeText={() => {}}
              />
            );
          case "switch":
            return (
              <Switch
                key={c.testID}
                testID={c.testID}
                value={c.checked}
                disabled={c.disabled}
                accessibilityLabel={c.label}
                accessibilityRole="switch"
                onValueChange={() => {}}
              />
            );
          case "box":
            return (
              <View
                key={c.testID}
                testID={c.testID}
                accessibilityLabel={c.label}
                accessibilityElementsHidden={c.hidden}
                importantForAccessibility={c.hidden ? "no-hide-descendants" : "auto"}
              />
            );
          default:
            return null;
        }
      })}
    </View>
  );
}

describe("property: RNTL queries", () => {
  test("ByTestId / ByText / ByLabelText / ByPlaceholderText / ByDisplayValue / ByHintText / ByRole", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc
          .record({
            rootId: idArb,
            children: fc.array(leafArb, { minLength: 1, maxLength: 5 }),
          })
          .map(dedupe),
        async (model) => {
          const screen = await render(toElement(model));
          const visible = model.children.filter((c) => !(c.kind === "box" && c.hidden));

          for (const c of visible) {
            expect(screen.getByTestId(c.testID)).toBeTruthy();
            expect(screen.queryByTestId(c.testID)).toBeTruthy();
            expect(screen.getAllByTestId(c.testID).length).toBe(1);
            expect(screen.queryAllByTestId(c.testID).length).toBe(1);
            await expect(screen.findByTestId(c.testID)).resolves.toBeTruthy();
            await expect(screen.findAllByTestId(c.testID)).resolves.toHaveLength(1);
          }

          for (const c of model.children) {
            if (c.kind === "text") {
              expect(screen.getByText(c.value)).toBeTruthy();
            }
            if (c.kind === "button" || c.kind === "input" || c.kind === "switch") {
              if (!(c.kind === "box")) {
                expect(screen.getByLabelText(c.label)).toBeTruthy();
              }
            }
            if (c.kind === "input") {
              expect(screen.getByPlaceholderText(c.placeholder)).toBeTruthy();
              expect(screen.getByDisplayValue(c.value)).toBeTruthy();
            }
            if (c.kind === "button" && c.hint) {
              expect(screen.getByHintText(c.hint)).toBeTruthy();
            }
            if (c.kind === "button" && !c.disabled) {
              const roles = screen.queryAllByRole("button", { name: c.label });
              expect(roles.length).toBeGreaterThanOrEqual(1);
            }
          }

          const missing = "missing-id-xyz";
          expect(screen.queryByTestId(missing)).toBeNull();
          expect(screen.queryAllByTestId(missing)).toEqual([]);
          expect(() => screen.getByTestId(missing)).toThrow();

          const root = screen.getByTestId(model.rootId);
          const scoped = within(root);
          const firstVisible = visible[0];
          if (firstVisible) {
            expect(scoped.getByTestId(firstVisible.testID)).toBeTruthy();
          }

          const json = screen.toJSON();
          expect(json).toBeTruthy();

          const next = (
            <View testID={model.rootId}>
              <Text testID="rerendered">hi</Text>
            </View>
          );
          await screen.rerender(next);
          expect(screen.getByTestId("rerendered")).toBeTruthy();

          await screen.unmount();
        },
      ),
      fcRuns(25),
    );
  }, 60_000);

  test("configure / resetToDefaults / isHiddenFromAccessibility / getDefaultNormalizer / cleanup / debug", async () => {
    resetToDefaults();
    configure({ defaultIncludeHiddenElements: false, asyncUtilTimeout: 1000 });

    const screen = await render(
      <View testID="wrap">
        <View testID="hidden" accessibilityElementsHidden>
          <Text>secret</Text>
        </View>
        <Text testID="plain"> Hello World </Text>
      </View>,
    );

    expect(screen.queryByTestId("hidden")).toBeNull();
    const hidden = screen.getByTestId("hidden", { includeHiddenElements: true });
    expect(isHiddenFromAccessibility(hidden)).toBe(true);

    const normalizer = getDefaultNormalizer({ collapseWhitespace: true, trim: true });
    expect(normalizer("  Hello   World  ")).toBe("Hello World");
    expect(screen.getByText("Hello World")).toBeTruthy();

    const logs: string[] = [];
    const loggerMod = require("@testing-library/react-native/dist/helpers/logger.js") as {
      _console: { info: (...args: unknown[]) => void };
    };
    const origInfo = loggerMod._console.info;
    loggerMod._console.info = (...args: unknown[]) => {
      logs.push(args.map(String).join(" "));
    };
    try {
      screen.debug();
    } finally {
      loggerMod._console.info = origInfo;
    }
    expect(logs.length).toBeGreaterThan(0);

    await screen.unmount();
    await cleanup();
    resetToDefaults();
  });
});
