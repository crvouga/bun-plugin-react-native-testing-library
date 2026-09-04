import { describe, expect, test } from "bun:test";
import { Text, View } from "react-native";
import { render } from "@testing-library/react-native";

describe("canary probe: matcher registration", () => {
  test("toBeOnTheScreen is available", async () => {
    const screen = await render(
      <View testID="root">
        <Text>Hi</Text>
      </View>,
    );
    expect(screen.getByTestId("root")).toBeOnTheScreen();
    screen.unmount();
  });
});
