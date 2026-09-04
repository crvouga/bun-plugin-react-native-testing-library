import { describe, expect, test } from "bun:test";
import { Text } from "react-native";
import { render } from "@testing-library/react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as fc from "fast-check";

describe("gesture-handler", () => {
  test("GestureHandlerRootView renders children", async () => {
    await fc.assert(
      fc.asyncProperty(fc.stringMatching(/^[A-Za-z]{1,8}$/), async (label) => {
        const screen = await render(
          <GestureHandlerRootView testID="gh-root">
            <Text testID="gh-label">{label}</Text>
          </GestureHandlerRootView>,
        );
        expect(screen.getByTestId("gh-root")).toBeOnTheScreen();
        expect(screen.getByText(label)).toBeTruthy();
        screen.unmount();
      }),
      { numRuns: 40 },
    );
  });
});
