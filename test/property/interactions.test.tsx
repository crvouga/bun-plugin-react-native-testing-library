/**
 * Property: fireEvent interactions vs models.
 * Prefer fireEvent over userEvent here — userEvent's timer integration
 * leaves Bun's fake-timer state dirty across property iterations.
 */

import { describe, expect, test } from "bun:test";
import { useState } from "react";
import {
  Button,
  Pressable,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  View,
} from "react-native";
import { render, fireEvent } from "@testing-library/react-native";
import * as fc from "fast-check";
import { fcOpts } from "../fc-opts.ts";

describe("property: interactions", () => {
  test("press on Pressable/Touchable/Button calls onPress unless disabled", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom("pressable", "touchable", "button") as fc.Arbitrary<
          "pressable" | "touchable" | "button"
        >,
        fc.boolean(),
        async (variant, disabled) => {
          let presses = 0;
          const onPress = () => {
            presses++;
          };

          const el =
            variant === "pressable" ? (
              <Pressable
                testID="t"
                disabled={disabled}
                onPress={onPress}
                accessibilityRole="button"
              >
                <Text>Go</Text>
              </Pressable>
            ) : variant === "touchable" ? (
              <TouchableOpacity testID="t" disabled={disabled} onPress={onPress}>
                <Text>Go</Text>
              </TouchableOpacity>
            ) : (
              <Button testID="t" title="Go" disabled={disabled} onPress={onPress} />
            );

          const screen = await render(el);
          if (!disabled) {
            await fireEvent.press(screen.getByTestId("t"));
            expect(presses).toBe(1);
          } else {
            expect(screen.getByTestId("t")).toBeDisabled();
          }
          screen.unmount();
        },
      ),
      fcOpts,
    );
  });

  test("TextInput onChangeText folds to final value", async () => {
    await fc.assert(
      fc.asyncProperty(fc.stringMatching(/^[A-Za-z0-9]{1,8}$/), async (typed) => {
        function Harness() {
          const [v, setV] = useState("");
          return <TextInput testID="in" value={v} onChangeText={setV} />;
        }
        const screen = await render(<Harness />);
        await fireEvent.changeText(screen.getByTestId("in"), typed);
        expect(screen.getByTestId("in")).toHaveDisplayValue(typed);
        screen.unmount();
      }),
      fcOpts,
    );
  });

  test("Switch toggles track model", async () => {
    await fc.assert(
      fc.asyncProperty(fc.boolean(), fc.integer({ min: 0, max: 5 }), async (initial, tapCount) => {
        let value = initial;
        function Harness() {
          const [v, setV] = useState(initial);
          return (
            <Switch
              testID="sw"
              value={v}
              onValueChange={(next) => {
                setV(next);
                value = next;
              }}
            />
          );
        }
        const screen = await render(<Harness />);
        for (let i = 0; i < tapCount; i++) {
          await fireEvent(screen.getByTestId("sw"), "valueChange", !value);
        }
        expect(value).toBe(tapCount % 2 === 0 ? initial : !initial);
        screen.unmount();
      }),
      fcOpts,
    );
  });

  test("fireEvent.scroll reaches onScroll", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 0, max: 500 }), async (y) => {
        let got = -1;
        const screen = await render(
          <ScrollView
            testID="sc"
            onScroll={(e: { nativeEvent?: { contentOffset?: { y?: number } } }) => {
              got = e?.nativeEvent?.contentOffset?.y ?? -1;
            }}
          >
            <View>
              <Text>x</Text>
            </View>
          </ScrollView>,
        );
        await fireEvent.scroll(screen.getByTestId("sc"), {
          nativeEvent: { contentOffset: { y, x: 0 } },
        });
        expect(got).toBe(y);
        screen.unmount();
      }),
      fcOpts,
    );
  });
});
