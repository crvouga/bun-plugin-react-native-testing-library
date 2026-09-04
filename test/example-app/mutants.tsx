/**
 * Fault-injected twin components for mutant / canary probes.
 */

import { useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

export type Fault =
  | "none"
  | "off-by-one"
  | "ignore-disabled"
  | "drop-last-item"
  | "wrong-testid"
  | "never-resolves"
  | "swallow-press";

export function MutantCounter({ bug = "none" }: { bug?: Fault }) {
  const [n, setN] = useState(0);
  const delta = bug === "off-by-one" ? 2 : 1;
  return (
    <View testID={bug === "wrong-testid" ? "wrong" : "counter"}>
      <Text testID="count">{n}</Text>
      <Pressable
        testID="inc"
        accessibilityRole="button"
        onPress={() => {
          if (bug === "swallow-press") return;
          setN((x) => x + delta);
        }}
      >
        <Text>+</Text>
      </Pressable>
    </View>
  );
}

export function MutantTodo({ bug = "none" }: { bug?: Fault }) {
  const [text, setText] = useState("");
  const [items, setItems] = useState<string[]>([]);
  return (
    <View testID="todo">
      <TextInput testID="input" value={text} onChangeText={setText} />
      <Pressable
        testID="add"
        accessibilityRole="button"
        onPress={() => {
          if (!text.trim()) return;
          setItems((xs) => {
            const next = [...xs, text.trim()];
            return bug === "drop-last-item" ? next.slice(0, -1) : next;
          });
          setText("");
        }}
      >
        <Text>Add</Text>
      </Pressable>
      {items.map((item, i) => (
        <Text key={`${item}-${i}`} testID={`item-${i}`}>
          {item}
        </Text>
      ))}
      <Text testID="total">{items.length}</Text>
    </View>
  );
}

export function MutantDisabledButton({ bug = "none", disabled }: { bug?: Fault; disabled: boolean }) {
  const [n, setN] = useState(0);
  const effectivelyDisabled = bug === "ignore-disabled" ? false : disabled;
  return (
    <Pressable
      testID="btn"
      disabled={effectivelyDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: effectivelyDisabled }}
      onPress={() => setN((x) => x + 1)}
    >
      <Text testID="n">{n}</Text>
    </Pressable>
  );
}

export function MutantAsync({ bug = "none" }: { bug?: Fault }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (bug === "never-resolves") return;
    const t = setTimeout(() => setReady(true), 30);
    return () => clearTimeout(t);
  }, [bug]);
  return ready ? <Text testID="ready">ok</Text> : <Text testID="pending">...</Text>;
}
