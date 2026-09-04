import { describe, expect, test } from "bun:test";
import { Text, View } from "react-native";
import { render } from "@testing-library/react-native";
import { getScreen } from "bun-plugin-react-native-testing-library/screen";

describe("sandbox sanity", () => {
  test("render + live getScreen + matchers", async () => {
    const screen = await render(
      <View testID="root">
        <Text testID="hi">hello sandbox</Text>
      </View>,
    );
    expect(screen.getByTestId("root")).toBeOnTheScreen();
    expect(getScreen().getByText("hello sandbox")).toBeTruthy();
    expect(screen.getByTestId("hi")).toHaveTextContent("hello sandbox");
  });
});
