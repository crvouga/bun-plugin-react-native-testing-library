/**
 * Property: fc.commands / asyncModelRun over a composite RN screen.
 */

import { describe, expect, test } from "bun:test";
import { useState } from "react";
import { FlatList, Pressable, Switch, Text, TextInput, View } from "react-native";
import { act, fireEvent, render } from "@testing-library/react-native";
import * as fc from "fast-check";
import { fcRuns } from "../fc-opts.ts";
import type { MonkeyModel, ScreenHandle } from "./commands/types.ts";

type Real = { screen: ScreenHandle };

function App() {
  const [text, setText] = useState("");
  const [on, setOn] = useState(false);
  const [items, setItems] = useState<string[]>([]);
  const [presses, setPresses] = useState(0);
  const [disabled, setDisabled] = useState(false);

  return (
    <View testID="app">
      <TextInput testID="input" value={text} onChangeText={setText} />
      <Switch testID="sw" value={on} onValueChange={setOn} />
      <Switch testID="dis" value={disabled} onValueChange={setDisabled} />
      <Pressable
        testID="add"
        accessibilityRole="button"
        onPress={() => {
          if (!text.trim()) return;
          setItems((prev) => [...prev, text.trim()]);
          setText("");
        }}
      >
        <Text>Add</Text>
      </Pressable>
      <Pressable
        testID="hit"
        accessibilityRole="button"
        disabled={disabled}
        onPress={() => {
          if (disabled) return;
          setPresses((p) => p + 1);
        }}
      >
        <Text testID="press-count">{presses}</Text>
      </Pressable>
      <Text testID="disabled-flag">{disabled ? "1" : "0"}</Text>
      <FlatList
        testID="list"
        data={items}
        keyExtractor={(x, i) => `${x}-${i}`}
        renderItem={({ item, index }) => (
          <View>
            <Text testID={`item-${index}`}>{item}</Text>
            <Pressable
              testID={`rm-${index}`}
              accessibilityRole="button"
              onPress={() => setItems((prev) => prev.filter((_, i) => i !== index))}
            >
              <Text>rm</Text>
            </Pressable>
          </View>
        )}
      />
    </View>
  );
}

class TypeCmd implements fc.AsyncCommand<MonkeyModel, Real> {
  constructor(readonly value: string) {}
  check = (m: Readonly<MonkeyModel>) => m.mounted;
  async run(m: MonkeyModel, r: Real): Promise<void> {
    m.text = this.value;
    await act(async () => {
      fireEvent.changeText(r.screen.getByTestId("input"), this.value);
    });
    expect(r.screen.getByTestId("input")).toHaveDisplayValue(m.text);
  }
  toString = () => `type(${JSON.stringify(this.value)})`;
}

class ToggleCmd implements fc.AsyncCommand<MonkeyModel, Real> {
  check = (m: Readonly<MonkeyModel>) => m.mounted;
  async run(m: MonkeyModel, r: Real): Promise<void> {
    m.on = !m.on;
    await act(async () => {
      fireEvent(r.screen.getByTestId("sw"), "valueChange", m.on);
    });
  }
  toString = () => "toggle";
}

class SetDisabledCmd implements fc.AsyncCommand<MonkeyModel, Real> {
  constructor(readonly next: boolean) {}
  check = (m: Readonly<MonkeyModel>) => m.mounted && m.disabled !== this.next;
  async run(m: MonkeyModel, r: Real): Promise<void> {
    m.disabled = this.next;
    await act(async () => {
      fireEvent(r.screen.getByTestId("dis"), "valueChange", this.next);
    });
    expect(r.screen.getByTestId("disabled-flag")).toHaveTextContent(this.next ? "1" : "0");
  }
  toString = () => `setDisabled(${this.next})`;
}

class AddCmd implements fc.AsyncCommand<MonkeyModel, Real> {
  check = (m: Readonly<MonkeyModel>) => m.mounted;
  async run(m: MonkeyModel, r: Real): Promise<void> {
    if (m.text.trim()) {
      m.items = [...m.items, m.text.trim()];
      m.text = "";
    }
    await act(async () => {
      fireEvent.press(r.screen.getByTestId("add"));
    });
    expect(r.screen.getByTestId("input")).toHaveDisplayValue(m.text);
    for (let i = 0; i < m.items.length; i++) {
      expect(r.screen.getByTestId(`item-${i}`)).toHaveTextContent(m.items[i]!);
    }
  }
  toString = () => "add";
}

class PressCmd implements fc.AsyncCommand<MonkeyModel, Real> {
  check = (m: Readonly<MonkeyModel>) => m.mounted && !m.disabled;
  async run(m: MonkeyModel, r: Real): Promise<void> {
    m.presses += 1;
    await act(async () => {
      fireEvent.press(r.screen.getByTestId("hit"));
    });
    expect(r.screen.getByTestId("press-count")).toHaveTextContent(String(m.presses));
  }
  toString = () => "press";
}

class DisabledPressCmd implements fc.AsyncCommand<MonkeyModel, Real> {
  check = (m: Readonly<MonkeyModel>) => m.mounted && m.disabled;
  async run(m: MonkeyModel, r: Real): Promise<void> {
    const before = m.presses;
    await act(async () => {
      fireEvent.press(r.screen.getByTestId("hit"));
    });
    expect(r.screen.getByTestId("press-count")).toHaveTextContent(String(before));
    expect(r.screen.getByTestId("hit")).toBeDisabled();
  }
  toString = () => "disabledPress";
}

class RemoveCmd implements fc.AsyncCommand<MonkeyModel, Real> {
  constructor(readonly index: number) {}
  check = (m: Readonly<MonkeyModel>) => m.mounted && m.items.length > 0;
  async run(m: MonkeyModel, r: Real): Promise<void> {
    const idx = this.index % m.items.length;
    m.items = m.items.filter((_, i) => i !== idx);
    await act(async () => {
      fireEvent.press(r.screen.getByTestId(`rm-${idx}`));
    });
    for (let i = 0; i < m.items.length; i++) {
      expect(r.screen.getByTestId(`item-${i}`)).toHaveTextContent(m.items[i]!);
    }
    if (m.items.length === 0) {
      expect(r.screen.queryByTestId("item-0")).toBeNull();
    }
  }
  toString = () => `remove(${this.index})`;
}

class AssertCmd implements fc.AsyncCommand<MonkeyModel, Real> {
  check = (m: Readonly<MonkeyModel>) => m.mounted;
  async run(m: MonkeyModel, r: Real): Promise<void> {
    expect(r.screen.queryByTestId("app")).toBeTruthy();
    expect(r.screen.getByTestId("press-count")).toHaveTextContent(String(m.presses));
    expect(r.screen.getByTestId("input")).toHaveDisplayValue(m.text);
  }
  toString = () => "assert";
}

const cmds = [
  fc.stringMatching(/^[A-Za-z]{0,6}$/).map((v) => new TypeCmd(v)),
  fc.constant(new ToggleCmd()),
  fc.boolean().map((d) => new SetDisabledCmd(d)),
  fc.constant(new AddCmd()),
  fc.constant(new PressCmd()),
  fc.constant(new DisabledPressCmd()),
  fc.nat({ max: 8 }).map((i) => new RemoveCmd(i)),
  fc.constant(new AssertCmd()),
];

describe("property: fc.commands monkey walk", () => {
  test("random command sequences keep screen == model", async () => {
    await fc.assert(
      fc.asyncProperty(fc.commands(cmds, { maxCommands: 24, size: "+1" }), async (commands) => {
        const screen = await render(<App />);
        await fc.asyncModelRun(
          () => ({
            model: {
              text: "",
              on: false,
              items: [] as string[],
              presses: 0,
              disabled: false,
              mounted: true,
            } satisfies MonkeyModel,
            real: { screen: screen as ScreenHandle },
          }),
          commands,
        );
        await screen.unmount();
      }),
      fcRuns(30),
    );
  }, 120_000);
});
