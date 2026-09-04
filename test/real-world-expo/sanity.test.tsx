import { describe, expect, test } from "bun:test";
import { Text, View } from "react-native";
import { render } from "@testing-library/react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Crypto from "expo-crypto";

describe("expo sandbox sanity", () => {
  test("renders and constants resolve", async () => {
    const screen = await render(
      <View testID="root">
        <Text testID="name">{String(Constants.name ?? "app")}</Text>
        <Text testID="device">{Device.modelName}</Text>
      </View>,
    );
    expect(screen.getByTestId("root")).toBeOnTheScreen();
    expect(screen.getByTestId("name")).toHaveTextContent("ExpoSandbox");
    expect(Crypto.randomUUID()).toMatch(/-/);
    screen.unmount();
  });
});
