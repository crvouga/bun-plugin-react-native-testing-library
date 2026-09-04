import { describe, expect, test } from "bun:test";
import { TextInput } from "react-native";
import { render } from "@testing-library/react-native";

describe("canary probe: textinput value", () => {
  test("TextInput exposes display value", async () => {
    const screen = await render(<TextInput testID="input" value="abc" onChangeText={() => {}} />);
    expect(screen.getByTestId("input")).toHaveDisplayValue("abc");
    screen.unmount();
  });
});
