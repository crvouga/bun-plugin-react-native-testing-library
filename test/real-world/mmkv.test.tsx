import { describe, expect, test } from "bun:test";
import { Text, View, Pressable } from "react-native";
import { render, fireEvent } from "@testing-library/react-native";
import { createMMKV, useMMKVString } from "react-native-mmkv";
import * as fc from "fast-check";

describe("react-native-mmkv", () => {
  test("createMMKV set/get matches model", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            key: fc.stringMatching(/^[a-z]{1,4}$/),
            value: fc.stringMatching(/^[A-Za-z0-9]{0,8}$/),
          }),
          { minLength: 1, maxLength: 10 },
        ),
        (pairs) => {
          const id = `mmkv-${Math.random()}`;
          const storage = createMMKV({ id } as any) as any;
          const model = new Map<string, string>();
          for (const { key, value } of pairs) {
            storage.set(key, value);
            model.set(key, value);
          }
          for (const [k, v] of model) {
            expect(storage.getString(k)).toBe(v);
          }
        },
      ),
      { numRuns: 40 },
    );
  });

  test("useMMKVString re-renders", async () => {
    function Editor() {
      const [value, setValue] = useMMKVString("name");
      return (
        <View>
          <Text testID="v">{value ?? ""}</Text>
          <Pressable testID="set" onPress={() => setValue("bob")}>
            <Text>set</Text>
          </Pressable>
        </View>
      );
    }
    const screen = await render(<Editor />);
    await fireEvent.press(screen.getByTestId("set"));
    expect(screen.getByTestId("v")).toHaveTextContent("bob");
  });
});
