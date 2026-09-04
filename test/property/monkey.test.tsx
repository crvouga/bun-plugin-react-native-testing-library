/**
 * Property: fc.commands-style monkey test over a composite screen.
 */

import { describe, expect, test } from "bun:test";
import { act, useState } from "react";
import { FlatList, Pressable, Switch, Text, TextInput, View } from "react-native";
import { fireEvent, render } from "@testing-library/react-native";
import * as fc from "fast-check";
import { fcRuns } from "../fc-opts.ts";

type Model = {
  text: string;
  on: boolean;
  items: string[];
  presses: number;
};

type Cmd = { type: "type"; value: string } | { type: "toggle" } | { type: "add" } | { type: "press" };

function reduce(m: Model, c: Cmd): Model {
  switch (c.type) {
    case "type":
      return { ...m, text: c.value };
    case "toggle":
      return { ...m, on: !m.on };
    case "add":
      return m.text.trim() ? { ...m, items: [...m.items, m.text.trim()], text: "" } : m;
    case "press":
      return { ...m, presses: m.presses + 1 };
  }
}

const cmdArb: fc.Arbitrary<Cmd> = fc.oneof(
  fc.stringMatching(/^[A-Za-z]{0,6}$/).map((value) => ({ type: "type" as const, value })),
  fc.constant({ type: "toggle" as const }),
  fc.constant({ type: "add" as const }),
  fc.constant({ type: "press" as const }),
);

function App({ onSnap }: { onSnap: (m: Model) => void }) {
  const [text, setText] = useState("");
  const [on, setOn] = useState(false);
  const [items, setItems] = useState<string[]>([]);
  const [presses, setPresses] = useState(0);

  const snap = (partial: Partial<Model>) => {
    const next: Model = {
      text: partial.text ?? text,
      on: partial.on ?? on,
      items: partial.items ?? items,
      presses: partial.presses ?? presses,
    };
    onSnap(next);
  };

  return (
    <View testID="app">
      <TextInput
        testID="input"
        value={text}
        onChangeText={(v) => {
          setText(v);
          snap({ text: v });
        }}
      />
      <Switch
        testID="sw"
        value={on}
        onValueChange={(v) => {
          setOn(v);
          snap({ on: v });
        }}
      />
      <Pressable
        testID="add"
        accessibilityRole="button"
        onPress={() => {
          if (!text.trim()) {
            snap({});
            return;
          }
          const nextItems = [...items, text.trim()];
          setItems(nextItems);
          setText("");
          snap({ items: nextItems, text: "" });
        }}
      >
        <Text>Add</Text>
      </Pressable>
      <Pressable
        testID="hit"
        accessibilityRole="button"
        onPress={() => {
          setPresses((p) => {
            const n = p + 1;
            // schedule snap after state commit via explicit value
            queueMicrotask(() => onSnap({ text, on, items, presses: n }));
            return n;
          });
        }}
      >
        <Text testID="press-count">{presses}</Text>
      </Pressable>
      <FlatList
        testID="list"
        data={items}
        keyExtractor={(x, i) => `${x}-${i}`}
        renderItem={({ item }) => <Text testID={`item-${item}`}>{item}</Text>}
      />
    </View>
  );
}

describe("property: monkey commands", () => {
  test("random command sequences keep screen == model", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(cmdArb, { minLength: 1, maxLength: 16 }), async (cmds) => {
        let live: Model = { text: "", on: false, items: [], presses: 0 };
        let expected: Model = { ...live };
        const screen = await render(
          <App
            onSnap={(m) => {
              live = m;
            }}
          />,
        );

        for (const c of cmds) {
          expected = reduce(expected, c);
          await act(async () => {
            switch (c.type) {
              case "type":
                fireEvent.changeText(screen.getByTestId("input"), c.value);
                break;
              case "toggle":
                fireEvent(screen.getByTestId("sw"), "valueChange", !live.on);
                break;
              case "add":
                fireEvent.press(screen.getByTestId("add"));
                break;
              case "press":
                fireEvent.press(screen.getByTestId("hit"));
                await Promise.resolve();
                break;
            }
          });

          expect(screen.getByTestId("input")).toHaveDisplayValue(expected.text);
          expect(screen.getByTestId("press-count")).toHaveTextContent(String(expected.presses));
          expect(live.items).toEqual(expected.items);
          for (const item of expected.items) {
            expect(screen.getByText(item)).toBeTruthy();
          }
        }
        screen.unmount();
      }),
      fcRuns(20),
    );
  }, 90_000);
});
