import { describe, expect, test } from "bun:test";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { render, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as fc from "fast-check";

describe("async-storage", () => {
  test("set/get/remove sequences match a Map model", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.oneof(
            fc.record({
              op: fc.constant("set" as const),
              key: fc.stringMatching(/^[a-z]{1,4}$/),
              value: fc.stringMatching(/^[A-Za-z0-9]{0,8}$/),
            }),
            fc.record({
              op: fc.constant("remove" as const),
              key: fc.stringMatching(/^[a-z]{1,4}$/),
            }),
            fc.record({ op: fc.constant("clear" as const) }),
          ),
          { minLength: 1, maxLength: 12 },
        ),
        async (ops) => {
          await AsyncStorage.clear();
          const model = new Map<string, string>();
          for (const op of ops) {
            if (op.op === "set") {
              await AsyncStorage.setItem(op.key, op.value);
              model.set(op.key, op.value);
            } else if (op.op === "remove") {
              await AsyncStorage.removeItem(op.key);
              model.delete(op.key);
            } else {
              await AsyncStorage.clear();
              model.clear();
            }
          }
          const keys = await AsyncStorage.getAllKeys();
          expect([...keys].sort()).toEqual([...model.keys()].sort());
          for (const [k, v] of model) {
            expect(await AsyncStorage.getItem(k)).toBe(v);
          }
        },
      ),
      { numRuns: 40 },
    );
  });

  test("hydration renders stored value", async () => {
    await AsyncStorage.clear();
    await AsyncStorage.setItem("user", "ada");

    function Hydrated() {
      const [v, setV] = useState<string | null>(null);
      useEffect(() => {
        void AsyncStorage.getItem("user").then(setV);
      }, []);
      return (
        <View testID="box">
          <Text testID="val">{v ?? "loading"}</Text>
        </View>
      );
    }

    const screen = await render(<Hydrated />);
    await waitFor(() => {
      expect(screen.getByTestId("val")).toHaveTextContent("ada");
    });
  });
});
