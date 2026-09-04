import { describe, expect, test } from "bun:test";
import { FlatList, Text } from "react-native";
import { render } from "@testing-library/react-native";

describe("canary probe: flatlist count", () => {
  test("FlatList renders every row", async () => {
    const data = ["a", "b", "c"];
    const screen = await render(
      <FlatList
        testID="list"
        data={data}
        keyExtractor={(x) => x}
        renderItem={({ item }) => <Text testID={`row-${item}`}>{item}</Text>}
      />,
    );
    for (const item of data) {
      expect(screen.getByTestId(`row-${item}`)).toBeOnTheScreen();
    }
    screen.unmount();
  });
});
