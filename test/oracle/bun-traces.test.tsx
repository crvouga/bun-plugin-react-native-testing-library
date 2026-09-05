/**
 * Bun-side differential oracle driver. Writes normalized traces to RN_BUN_ORACLE_OUT.
 */

import { describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { act, fireEvent, render } from "@testing-library/react-native";
import { ORACLE_SEQUENCE, type TraceOp, type TraceResult } from "./shared-trace.ts";

function OracleApp({ label }: { label: string }) {
  const [text, setText] = useState("");
  const [presses, setPresses] = useState(0);
  return (
    <View testID="root" accessibilityLabel="root-view">
      <Text testID="title">{label}</Text>
      <TextInput testID="input" accessibilityLabel="name-input" value={text} onChangeText={setText} />
      <Pressable
        testID="btn"
        accessibilityRole="button"
        accessibilityLabel="increment"
        onPress={() => setPresses((p) => p + 1)}
      >
        <Text testID="count">{presses}</Text>
      </Pressable>
      <Text testID="echo">{text}</Text>
    </View>
  );
}

describe("oracle: bun traces", () => {
  test("emit deterministic operation trace", async () => {
    const ops: TraceOp[] = [];
    let presses = 0;
    let text = "";
    let label = "v1";

    const screen = await render(<OracleApp label={label} />);
    ops.push({ op: "render" });

    for (const step of ORACLE_SEQUENCE) {
      if (step === "render") continue;
      if (step === "query-root") {
        const found = screen.queryByTestId("root") != null;
        ops.push({ op: "queryByTestId", id: "root", found });
        expect(found).toBe(true);
      } else if (step === "query-button-role") {
        const found = screen.queryByRole("button") != null;
        ops.push({ op: "queryByRole", role: "button", found });
        expect(found).toBe(true);
      } else if (step === "query-label") {
        const found = screen.queryByLabelText("increment") != null;
        ops.push({ op: "getByLabelText", label: "increment", found });
        expect(found).toBe(true);
      } else if (step === "type") {
        text = "hello";
        await act(async () => {
          fireEvent.changeText(screen.getByTestId("input"), text);
        });
        ops.push({ op: "changeText", id: "input", value: text });
      } else if (step === "press") {
        presses += 1;
        await act(async () => {
          fireEvent.press(screen.getByTestId("btn"));
        });
        ops.push({ op: "press", id: "btn" });
        ops.push({ op: "assert", key: "count", value: String(presses) });
        expect(screen.getByTestId("count")).toHaveTextContent(String(presses));
      } else if (step === "rerender") {
        label = "v2";
        await screen.rerender(<OracleApp label={label} />);
        ops.push({ op: "rerender", label });
        ops.push({ op: "queryByText", text: "v2", found: screen.queryByText("v2") != null });
      } else if (step === "query-text") {
        const found = screen.queryByText("hello") != null;
        ops.push({ op: "queryByText", text: "hello", found });
      } else if (step === "unmount") {
        await screen.unmount();
        ops.push({ op: "unmount" });
      }
    }

    const result: TraceResult = { ops, presses, text, label };
    const out = process.env.RN_BUN_ORACLE_OUT ?? join(import.meta.dir, "../../.compat-out/oracle-corpus/bun-trace.json");
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, `${JSON.stringify(result)}\n`);
  });
});
