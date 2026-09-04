import { describe, expect, test } from "bun:test";
import { Pressable, Text } from "react-native";
import { render } from "@testing-library/react-native";

describe("canary probe: pressable disabled", () => {
  test("disabled Pressable is reported disabled", async () => {
    const screen = await render(
      <Pressable testID="btn" disabled accessibilityRole="button" onPress={() => {}}>
        <Text>Go</Text>
      </Pressable>,
    );
    expect(screen.getByTestId("btn")).toBeDisabled();
    screen.unmount();
  });
});
