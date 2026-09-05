/**
 * Navigation stack model via fc.commands (replaces constant-null property).
 */

import { describe, expect, test } from "bun:test";
import { Text, View } from "react-native";
import { act, fireEvent, render } from "@testing-library/react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import * as fc from "fast-check";

const Stack = createNativeStackNavigator();
const opts = { numRuns: 25, endOnFailure: true as const, seed: 0x5a17e0e1 };

type Model = { stack: string[] };
type Real = { screen: Awaited<ReturnType<typeof render>> };

function Home({ navigation }: { navigation: { navigate: (r: string, p?: object) => void } }) {
  return (
    <View testID="home">
      <Text>Home</Text>
      <Text testID="go-detail" onPress={() => navigation.navigate("Detail", { id: "x" })} accessibilityRole="button">
        Go
      </Text>
    </View>
  );
}

function Detail({
  navigation,
  route,
}: {
  navigation: { goBack: () => void; navigate: (r: string) => void };
  route: { params?: { id?: string } };
}) {
  return (
    <View testID="detail">
      <Text testID="param">{route.params?.id ?? ""}</Text>
      <Text testID="go-home" onPress={() => navigation.goBack()} accessibilityRole="button">
        Back
      </Text>
      <Text testID="go-other" onPress={() => navigation.navigate("Other")} accessibilityRole="button">
        Other
      </Text>
    </View>
  );
}

function Other({ navigation }: { navigation: { goBack: () => void } }) {
  return (
    <View testID="other">
      <Text>Other</Text>
      <Text testID="back" onPress={() => navigation.goBack()} accessibilityRole="button">
        Back
      </Text>
    </View>
  );
}

function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Home" component={Home} />
        <Stack.Screen name="Detail" component={Detail} />
        <Stack.Screen name="Other" component={Other} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

class PushDetail implements fc.AsyncCommand<Model, Real> {
  check = (m: Readonly<Model>) => m.stack[m.stack.length - 1] === "Home";
  async run(m: Model, r: Real): Promise<void> {
    m.stack = [...m.stack, "Detail"];
    await act(async () => {
      fireEvent.press(r.screen.getByTestId("go-detail"));
    });
    expect(r.screen.getByTestId("detail")).toBeOnTheScreen();
    expect(r.screen.getByTestId("param")).toHaveTextContent("x");
  }
  toString = () => "pushDetail";
}

class Pop implements fc.AsyncCommand<Model, Real> {
  check = (m: Readonly<Model>) => m.stack.length > 1;
  async run(m: Model, r: Real): Promise<void> {
    const top = m.stack[m.stack.length - 1];
    m.stack = m.stack.slice(0, -1);
    const btn = top === "Other" ? "back" : "go-home";
    await act(async () => {
      fireEvent.press(r.screen.getByTestId(btn));
    });
    const expectId = m.stack[m.stack.length - 1]!.toLowerCase();
    expect(r.screen.getByTestId(expectId === "home" ? "home" : expectId)).toBeOnTheScreen();
  }
  toString = () => "pop";
}

class PushOther implements fc.AsyncCommand<Model, Real> {
  check = (m: Readonly<Model>) => m.stack[m.stack.length - 1] === "Detail";
  async run(m: Model, r: Real): Promise<void> {
    m.stack = [...m.stack, "Other"];
    await act(async () => {
      fireEvent.press(r.screen.getByTestId("go-other"));
    });
    expect(r.screen.getByTestId("other")).toBeOnTheScreen();
  }
  toString = () => "pushOther";
}

describe("react-navigation commands", () => {
  test("stack push/pop sequences match model", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.commands([fc.constant(new PushDetail()), fc.constant(new Pop()), fc.constant(new PushOther())], {
          maxCommands: 12,
        }),
        async (commands) => {
          const screen = await render(<App />);
          await fc.asyncModelRun(
            () => ({
              model: { stack: ["Home"] },
              real: { screen },
            }),
            commands,
          );
          await screen.unmount();
        },
      ),
      opts,
    );
  }, 90_000);
});
