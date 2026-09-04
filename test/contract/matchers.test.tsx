/**
 * Contract: RNTL matchers are registered and behave on mocked hosts.
 */

import { describe, expect, test } from "bun:test";
import { Text, Pressable, Switch, TextInput, View } from "react-native";
import { render } from "@testing-library/react-native";
import { RNTL_MATCHER_NAMES } from "../../src/rntl.ts";

describe("contract: RNTL matchers", () => {
  test("known matcher names are documented", () => {
    expect(RNTL_MATCHER_NAMES.length).toBeGreaterThanOrEqual(14);
  });

  test("toBeOnTheScreen / toHaveTextContent / toBeVisible", async () => {
    const screen = await render(
      <View testID="root">
        <Text testID="label">Hello</Text>
      </View>,
    );
    expect(screen.getByTestId("root")).toBeOnTheScreen();
    expect(screen.getByText("Hello")).toHaveTextContent("Hello");
    expect(screen.getByTestId("label")).toBeVisible();
  });

  test("toHaveDisplayValue on TextInput", async () => {
    const screen = await render(
      <TextInput testID="input" value="abc" onChangeText={() => {}} />,
    );
    expect(screen.getByTestId("input")).toHaveDisplayValue("abc");
  });

  test("toBeChecked on Switch", async () => {
    const screen = await render(
      <Switch testID="sw" value={true} onValueChange={() => {}} />,
    );
    expect(screen.getByTestId("sw")).toBeChecked();
  });

  test("toBeDisabled on Pressable", async () => {
    const screen = await render(
      <Pressable testID="btn" disabled accessibilityRole="button" onPress={() => {}}>
        <Text>Go</Text>
      </Pressable>,
    );
    expect(screen.getByTestId("btn")).toBeDisabled();
  });
});
