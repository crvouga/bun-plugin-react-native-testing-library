/**
 * SDK 58 baseline: RN core + RNTL under bun test on React Native 0.88 / React 19.3.
 */
import { describe, expect, test } from "bun:test";
import { Pressable, Text, View } from "react-native";
import { render, fireEvent } from "@testing-library/react-native";

describe("expo58 sanity", () => {
  test("renders and presses", async () => {
    function App() {
      return (
        <View testID="wrap">
          <Text testID="label">sdk58</Text>
          <Pressable testID="btn" onPress={() => {}}>
            <Text>go</Text>
          </Pressable>
        </View>
      );
    }
    const screen = await render(<App />);
    expect(screen.getByTestId("label")).toBeOnTheScreen();
    expect(screen.getByTestId("label")).toHaveTextContent("sdk58");
    await fireEvent.press(screen.getByTestId("btn"));
    screen.unmount();
  });

  test("expo SDK major is 58", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pkg = require("expo/package.json") as { version: string };
    expect(pkg.version.startsWith("58.")).toBe(true);
  });
});
