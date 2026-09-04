/**
 * Property: arbitrary RN element trees vs RNTL queries/matchers.
 */

import { describe, expect, test } from "bun:test";
import * as React from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  Switch,
  Image,
  ScrollView,
  Modal,
} from "react-native";
import { render } from "@testing-library/react-native";
import * as fc from "fast-check";
import { fcOpts } from "../fc-opts.ts";

const HOST_NAMES = new Set([
  "View",
  "Text",
  "TextInput",
  "RCTSwitch",
  "Image",
  "RCTScrollView",
  "Modal",
  "Pressable", // shouldn't appear — Pressable renders View
]);

type ModelNode =
  | { kind: "view"; testID: string; children: ModelNode[]; hidden?: boolean }
  | { kind: "text"; testID: string; value: string }
  | { kind: "pressable"; testID: string; label: string; disabled: boolean }
  | { kind: "input"; testID: string; value: string }
  | { kind: "switch"; testID: string; value: boolean; disabled: boolean }
  | { kind: "image"; testID: string }
  | { kind: "scroll"; testID: string; children: ModelNode[] }
  | { kind: "modal"; testID: string; visible: boolean; children: ModelNode[] };

const idArb = fc.integer({ min: 1, max: 9999 }).map((n) => `id-${n}`);
const textArb = fc.stringMatching(/^[A-Za-z][A-Za-z0-9 ]{0,12}$/);

const leafArb: fc.Arbitrary<ModelNode> = fc.oneof(
  idArb.chain((testID) => textArb.map((value) => ({ kind: "text" as const, testID, value }))),
  idArb.map((testID) => ({ kind: "image" as const, testID })),
  idArb.chain((testID) =>
    fc.record({
      testID: fc.constant(testID),
      label: textArb,
      disabled: fc.boolean(),
    }).map((r) => ({ kind: "pressable" as const, ...r })),
  ),
  idArb.chain((testID) =>
    textArb.map((value) => ({ kind: "input" as const, testID, value })),
  ),
  idArb.chain((testID) =>
    fc.record({ value: fc.boolean(), disabled: fc.boolean() }).map((r) => ({
      kind: "switch" as const,
      testID,
      ...r,
    })),
  ),
);

function makeTreeArb(depth: number): fc.Arbitrary<ModelNode> {
  if (depth <= 0) return leafArb;
  const child = makeTreeArb(depth - 1);
  return fc.oneof(
    leafArb,
    fc.record({
      testID: idArb,
      children: fc.array(child, { minLength: 0, maxLength: 3 }),
      hidden: fc.boolean(),
    }).map((r) => ({ kind: "view" as const, ...r })),
    fc.record({
      testID: idArb,
      children: fc.array(child, { minLength: 0, maxLength: 2 }),
    }).map((r) => ({ kind: "scroll" as const, ...r })),
    fc.record({
      testID: idArb,
      visible: fc.boolean(),
      children: fc.array(leafArb, { minLength: 0, maxLength: 2 }),
    }).map((r) => ({ kind: "modal" as const, ...r })),
  );
}

function dedupeIds(node: ModelNode, seen = new Set<string>()): ModelNode {
  const uniq = (id: string) => {
    let x = id;
    let i = 0;
    while (seen.has(x)) x = `${id}-${++i}`;
    seen.add(x);
    return x;
  };
  switch (node.kind) {
    case "view":
      return {
        ...node,
        testID: uniq(node.testID),
        children: node.children.map((c) => dedupeIds(c, seen)),
      };
    case "scroll":
      return {
        ...node,
        testID: uniq(node.testID),
        children: node.children.map((c) => dedupeIds(c, seen)),
      };
    case "modal":
      return {
        ...node,
        testID: uniq(node.testID),
        children: node.children.map((c) => dedupeIds(c, seen)),
      };
    default:
      return { ...node, testID: uniq(node.testID) } as ModelNode;
  }
}

function toElement(node: ModelNode): React.ReactElement {
  switch (node.kind) {
    case "text":
      return <Text testID={node.testID}>{node.value}</Text>;
    case "image":
      return <Image testID={node.testID} source={{ uri: "x" }} />;
    case "pressable":
      return (
        <Pressable
          testID={node.testID}
          accessibilityRole="button"
          accessibilityLabel={node.label}
          disabled={node.disabled}
          onPress={() => {}}
        >
          <Text>{node.label}</Text>
        </Pressable>
      );
    case "input":
      return <TextInput testID={node.testID} value={node.value} onChangeText={() => {}} />;
    case "switch":
      return (
        <Switch
          testID={node.testID}
          value={node.value}
          disabled={node.disabled}
          onValueChange={() => {}}
        />
      );
    case "view":
      return (
        <View
          testID={node.testID}
          style={node.hidden ? { display: "none" } : undefined}
        >
          {node.children.map((c, i) => (
            <React.Fragment key={i}>{toElement(c)}</React.Fragment>
          ))}
        </View>
      );
    case "scroll":
      return (
        <ScrollView testID={node.testID}>
          {node.children.map((c, i) => (
            <React.Fragment key={i}>{toElement(c)}</React.Fragment>
          ))}
        </ScrollView>
      );
    case "modal":
      return (
        <Modal testID={node.testID} visible={node.visible}>
          {node.children.map((c, i) => (
            <React.Fragment key={i}>{toElement(c)}</React.Fragment>
          ))}
        </Modal>
      );
  }
}

function collectTestIds(node: ModelNode, out: string[] = []): string[] {
  out.push(node.testID);
  if ("children" in node && Array.isArray(node.children)) {
    for (const c of node.children) collectTestIds(c, out);
  }
  // Modal with visible=false is not on screen
  if (node.kind === "modal" && !node.visible) {
    return out.filter((id) => id === node.testID); // modal host itself may be absent
  }
  return out;
}

function collectVisibleTestIds(node: ModelNode, out: string[] = []): string[] {
  if (node.kind === "modal" && !node.visible) return out;
  if (node.kind === "view" && node.hidden) return out;
  out.push(node.testID);
  if ("children" in node && Array.isArray(node.children)) {
    for (const c of node.children) collectVisibleTestIds(c, out);
  }
  return out;
}

function collectTextLeaves(node: ModelNode, out: string[] = []): string[] {
  if (node.kind === "modal" && !node.visible) return out;
  if (node.kind === "view" && node.hidden) return out;
  if (node.kind === "text") out.push(node.value);
  if (node.kind === "pressable") out.push(node.label);
  if ("children" in node && Array.isArray(node.children)) {
    for (const c of node.children) collectTextLeaves(c, out);
  }
  return out;
}

function collectHostTypes(json: unknown, out: string[] = []): string[] {
  if (json == null) return out;
  if (Array.isArray(json)) {
    for (const x of json) collectHostTypes(x, out);
    return out;
  }
  if (typeof json === "object") {
    const o = json as { type?: string; children?: unknown };
    if (typeof o.type === "string") out.push(o.type);
    if (o.children) collectHostTypes(o.children, out);
  }
  return out;
}

describe("property: RN tree vs RNTL queries", () => {
  test("testIDs / text / host types / disabled / checked agree with model", async () => {
    await fc.assert(
      fc.asyncProperty(makeTreeArb(2).map((n) => dedupeIds(n)), async (model) => {
        const { getByTestId, queryByTestId, getByText, toJSON, unmount } = await render(
          toElement(model),
        );

        const visibleIds = collectVisibleTestIds(model);
        for (const id of visibleIds) {
          if (model.kind === "modal" && id === model.testID && model.visible) {
            expect(getByTestId(id)).toBeTruthy();
          } else if (!(model.kind === "modal" && !model.visible && id === model.testID)) {
            expect(queryByTestId(id)).toBeTruthy();
          }
        }

        for (const t of collectTextLeaves(model)) {
          if (t.length > 0) expect(getByText(t)).toBeTruthy();
        }

        const hosts = collectHostTypes(toJSON());
        for (const h of hosts) {
          expect(h).not.toBe("Pressable");
          void HOST_NAMES;
        }

        const walk = (n: ModelNode) => {
          if (n.kind === "modal" && !n.visible) return;
          if (n.kind === "view" && n.hidden) return;
          if (n.kind === "pressable" && n.disabled) {
            expect(getByTestId(n.testID)).toBeDisabled();
          }
          if (n.kind === "switch" && !n.disabled) {
            if (n.value) expect(getByTestId(n.testID)).toBeChecked();
          }
          if ("children" in n) for (const c of n.children) walk(c);
        };
        walk(model);

        unmount();
      }),
      fcOpts,
    );
  });
});
