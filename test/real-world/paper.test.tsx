import { describe, expect, test } from "bun:test";
import { View } from "react-native";
import { render, fireEvent } from "@testing-library/react-native";
import { Provider as PaperProvider, Button, TextInput, Switch } from "react-native-paper";
import * as fc from "fast-check";

describe("react-native-paper", () => {
  test("Button / TextInput / Switch interactions", async () => {
    await fc.assert(
      fc.asyncProperty(fc.stringMatching(/^[A-Za-z0-9]{1,8}$/), fc.boolean(), async (text, initial) => {
        let pressed = 0;
        let value = "";
        let on = initial;
        const screen = await render(
          <PaperProvider>
            <View>
              <Button testID="btn" onPress={() => pressed++}>
                Go
              </Button>
              <TextInput
                testID="ti"
                value={value}
                onChangeText={(t) => {
                  value = t;
                }}
              />
              <Switch
                testID="sw"
                value={on}
                onValueChange={(v) => {
                  on = v;
                }}
              />
            </View>
          </PaperProvider>,
        );
        await fireEvent.press(screen.getByTestId("btn"));
        expect(pressed).toBe(1);
        await fireEvent.changeText(screen.getByTestId("ti"), text);
        await fireEvent(screen.getByTestId("sw"), "valueChange", !initial);
        expect(on).toBe(!initial);
        screen.unmount();
      }),
      { numRuns: 20 },
    );
  });
});
