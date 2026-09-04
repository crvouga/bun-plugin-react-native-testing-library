import { describe, expect, test } from "bun:test";
import { Text, View } from "react-native";
import { render, fireEvent } from "@testing-library/react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import * as fc from "fast-check";

const Stack = createNativeStackNavigator();

function Home({ navigation }: { navigation: { navigate: (r: string) => void } }) {
  return (
    <View testID="home">
      <Text>Home</Text>
      <Text testID="go-detail" onPress={() => navigation.navigate("Detail")} accessibilityRole="button">
        Go
      </Text>
    </View>
  );
}

function Detail() {
  return (
    <View testID="detail">
      <Text>Detail</Text>
    </View>
  );
}

describe("react-navigation native-stack", () => {
  test("navigates home -> detail", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constant(null), async () => {
        const screen = await render(
          <NavigationContainer>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
              <Stack.Screen name="Home" component={Home} />
              <Stack.Screen name="Detail" component={Detail} />
            </Stack.Navigator>
          </NavigationContainer>,
        );
        expect(screen.getByTestId("home")).toBeOnTheScreen();
        await fireEvent.press(screen.getByTestId("go-detail"));
        expect(screen.getByTestId("detail")).toBeOnTheScreen();
        screen.unmount();
      }),
      { numRuns: 10 },
    );
  });
});
