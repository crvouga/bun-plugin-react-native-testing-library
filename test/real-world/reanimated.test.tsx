import { describe, expect, test } from "bun:test";
import { Text, View } from "react-native";
import { render } from "@testing-library/react-native";
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from "react-native-reanimated";
import * as fc from "fast-check";

describe("reanimated", () => {
  test("shared values and animated styles are usable", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 0, max: 100 }), async (opacity) => {
        function Box() {
          const o = useSharedValue(opacity / 100);
          const style = useAnimatedStyle(() => ({ opacity: o.value }));
          // trigger withTiming so the mock path runs
          o.value = withTiming(opacity / 100) as unknown as number;
          return (
            <Animated.View testID="box" style={[{ width: 10, height: 10 }, style]}>
              <Text>{opacity}</Text>
            </Animated.View>
          );
        }
        const screen = await render(
          <View>
            <Box />
          </View>,
        );
        expect(screen.getByTestId("box")).toBeOnTheScreen();
        expect(screen.getByText(String(opacity))).toBeTruthy();
        screen.unmount();
      }),
      { numRuns: 40 },
    );
  });
});
