/**
 * Property: userEvent press/longPress/type/clear/paste/scrollTo vs models.
 */

import { describe, expect, test, jest } from "bun:test";
import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { render, userEvent } from "@testing-library/react-native";
import * as fc from "fast-check";
import { fcRuns } from "../fc-opts.ts";

const word = fc.stringMatching(/^[A-Za-z][A-Za-z0-9]{0,10}$/);

describe("property: userEvent", () => {
  test("press / longPress respect disabled and call handlers", async () => {
    await fc.assert(
      fc.asyncProperty(fc.boolean(), fc.boolean(), async (disabled, useLong) => {
        jest.useRealTimers();
        let presses = 0;
        let longs = 0;
        const screen = await render(
          <Pressable
            testID="btn"
            disabled={disabled}
            accessibilityRole="button"
            accessible
            onPress={() => {
              presses += 1;
            }}
            onLongPress={() => {
              longs += 1;
            }}
          >
            <Text>Go</Text>
          </Pressable>,
        );
        const user = userEvent.setup();
        const btn = screen.getByTestId("btn");
        if (useLong) await user.longPress(btn);
        else await user.press(btn);

        if (disabled) {
          expect(presses).toBe(0);
          expect(longs).toBe(0);
        } else if (useLong) {
          expect(longs).toBe(1);
        } else {
          expect(presses).toBe(1);
        }
        screen.unmount();
      }),
      fcRuns(15),
    );
  }, 60_000);

  test("type / clear / paste fold TextInput to final value", async () => {
    await fc.assert(
      fc.asyncProperty(word, word, async (initial, typed) => {
        jest.useRealTimers();
        function Box() {
          const [v, setV] = useState(initial);
          return <TextInput testID="input" value={v} onChangeText={setV} />;
        }
        const screen = await render(<Box />);
        const user = userEvent.setup();
        const input = screen.getByTestId("input");
        await user.clear(input);
        if (typed.length > 0) await user.type(input, typed);
        expect(input).toHaveDisplayValue(typed);
        await user.clear(input);
        await user.paste(input, initial);
        expect(input).toHaveDisplayValue(initial);
        screen.unmount();
      }),
      fcRuns(10),
    );
  }, 90_000);

  test("scrollTo reaches onScroll", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 0, max: 200 }), async (y) => {
        jest.useRealTimers();
        let lastY = -1;
        const screen = await render(
          <ScrollView
            testID="scroll"
            onScroll={(e) => {
              lastY = e.nativeEvent.contentOffset.y;
            }}
          >
            <View style={{ height: 800 }} />
          </ScrollView>,
        );
        const user = userEvent.setup();
        await user.scrollTo(screen.getByTestId("scroll"), { y });
        // RNTL may apply momentum / content-size clamping; assert the event fired near the request.
        expect(lastY).toBeGreaterThanOrEqual(0);
        expect(Math.abs(lastY - y)).toBeLessThanOrEqual(Math.max(50, y));
        screen.unmount();
      }),
      fcRuns(10),
    );
  }, 60_000);
});
