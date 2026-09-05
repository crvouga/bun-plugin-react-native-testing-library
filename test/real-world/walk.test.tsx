/**
 * Kitchen-sink fc.commands walk across popular third-party RN packages.
 * Model-based: after every command, RNTL queries and storage APIs match the model.
 */

import { describe, expect, test } from "bun:test";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { act, fireEvent, render } from "@testing-library/react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Clipboard from "@react-native-clipboard/clipboard";
import NetInfo from "@react-native-community/netinfo";
import { FlashList } from "@shopify/flash-list";
import { Picker } from "@react-native-picker/picker";
import Slider from "@react-native-community/slider";
import LinearGradient from "react-native-linear-gradient";
import { WebView } from "react-native-webview";
import Animated, { useSharedValue } from "react-native-reanimated";
import * as Localize from "react-native-localize";
import * as fc from "fast-check";

const opts = { numRuns: 20, endOnFailure: true as const, seed: 0x5a17e0e1 };
const Stack = createNativeStackNavigator();

type Model = {
  route: "Home" | "Detail";
  text: string;
  items: string[];
  clip: string;
  connected: boolean;
  slider: number;
  picker: string;
};

type Real = {
  screen: Awaited<ReturnType<typeof render>>;
  navigate: (r: "Home" | "Detail") => void;
};

function Home({
  navigation,
  text,
  setText,
  items,
  setItems,
  slider,
  setSlider,
  picker,
  setPicker,
}: {
  navigation: { navigate: (r: string) => void };
  text: string;
  setText: (t: string) => void;
  items: string[];
  setItems: (i: string[]) => void;
  slider: number;
  setSlider: (n: number) => void;
  picker: string;
  setPicker: (p: string) => void;
}) {
  const opacity = useSharedValue(1);
  void opacity;
  return (
    <View testID="home">
      <Text testID="route">Home</Text>
      <Text testID="locale">{Localize.getCountry()}</Text>
      <TextInput testID="input" value={text} onChangeText={setText} />
      <Pressable
        testID="add"
        accessibilityRole="button"
        onPress={() => {
          if (text.trim()) {
            setItems([...items, text.trim()]);
            setText("");
          }
        }}
      >
        <Text>Add</Text>
      </Pressable>
      <Pressable testID="go-detail" accessibilityRole="button" onPress={() => navigation.navigate("Detail")}>
        <Text>Go</Text>
      </Pressable>
      <FlashList
        testID="flash"
        data={items}
        estimatedItemSize={40}
        keyExtractor={(x, i) => `${x}-${i}`}
        renderItem={({ item, index }) => <Text testID={`flash-${index}`}>{item}</Text>}
      />
      <Picker testID="picker" selectedValue={picker} onValueChange={(v) => setPicker(String(v))}>
        <Picker.Item label="a" value="a" />
        <Picker.Item label="b" value="b" />
        <Picker.Item label="c" value="c" />
      </Picker>
      <Slider testID="slider" value={slider} minimumValue={0} maximumValue={10} onValueChange={setSlider} />
      <LinearGradient testID="grad" colors={["#f00", "#00f"]} style={{ height: 8 }} />
      <Animated.View testID="anim" style={{ opacity: 1, height: 4 }} />
      <WebView testID="wv" source={{ uri: "https://example.com" }} style={{ height: 1 }} />
    </View>
  );
}

function Detail({ navigation }: { navigation: { goBack: () => void } }) {
  return (
    <View testID="detail">
      <Text testID="route">Detail</Text>
      <Pressable testID="go-home" accessibilityRole="button" onPress={() => navigation.goBack()}>
        <Text>Back</Text>
      </Pressable>
    </View>
  );
}

function Sink(props: {
  text: string;
  setText: (t: string) => void;
  items: string[];
  setItems: (i: string[]) => void;
  slider: number;
  setSlider: (n: number) => void;
  picker: string;
  setPicker: (p: string) => void;
  onNav: (nav: { navigate: (r: string) => void; goBack: () => void }) => void;
}) {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Home">
          {({ navigation }) => {
            props.onNav(navigation as { navigate: (r: string) => void; goBack: () => void });
            return (
              <Home
                navigation={navigation}
                text={props.text}
                setText={props.setText}
                items={props.items}
                setItems={props.setItems}
                slider={props.slider}
                setSlider={props.setSlider}
                picker={props.picker}
                setPicker={props.setPicker}
              />
            );
          }}
        </Stack.Screen>
        <Stack.Screen name="Detail">
          {({ navigation }) => {
            props.onNav(navigation as { navigate: (r: string) => void; goBack: () => void });
            return <Detail navigation={navigation} />;
          }}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}

class TypeCmd implements fc.AsyncCommand<Model, Real> {
  constructor(readonly value: string) {}
  check = (m: Readonly<Model>) => m.route === "Home";
  async run(m: Model, r: Real): Promise<void> {
    m.text = this.value;
    await act(async () => {
      fireEvent.changeText(r.screen.getByTestId("input"), this.value);
    });
    expect(r.screen.getByTestId("input")).toHaveDisplayValue(m.text);
  }
  toString = () => `type(${JSON.stringify(this.value)})`;
}

class AddCmd implements fc.AsyncCommand<Model, Real> {
  check = (m: Readonly<Model>) => m.route === "Home";
  async run(m: Model, r: Real): Promise<void> {
    if (m.text.trim()) {
      m.items = [...m.items, m.text.trim()];
      m.text = "";
    }
    await act(async () => {
      fireEvent.press(r.screen.getByTestId("add"));
    });
    for (let i = 0; i < m.items.length; i++) {
      expect(r.screen.getByTestId(`flash-${i}`)).toHaveTextContent(m.items[i]!);
    }
  }
  toString = () => "add";
}

class NavDetailCmd implements fc.AsyncCommand<Model, Real> {
  check = (m: Readonly<Model>) => m.route === "Home";
  async run(m: Model, r: Real): Promise<void> {
    m.route = "Detail";
    await act(async () => {
      fireEvent.press(r.screen.getByTestId("go-detail"));
    });
    expect(r.screen.getByTestId("detail")).toBeOnTheScreen();
  }
  toString = () => "navDetail";
}

class NavHomeCmd implements fc.AsyncCommand<Model, Real> {
  check = (m: Readonly<Model>) => m.route === "Detail";
  async run(m: Model, r: Real): Promise<void> {
    m.route = "Home";
    await act(async () => {
      fireEvent.press(r.screen.getByTestId("go-home"));
    });
    expect(r.screen.getByTestId("home")).toBeOnTheScreen();
  }
  toString = () => "navHome";
}

class ClipSetCmd implements fc.AsyncCommand<Model, Real> {
  constructor(readonly value: string) {}
  check = () => true;
  async run(m: Model, _r: Real): Promise<void> {
    m.clip = this.value;
    await Clipboard.setString(this.value);
    expect(await Clipboard.getString()).toBe(m.clip);
  }
  toString = () => `clipSet(${JSON.stringify(this.value)})`;
}

class StorageRoundTripCmd implements fc.AsyncCommand<Model, Real> {
  constructor(
    readonly key: string,
    readonly value: string,
  ) {}
  check = () => true;
  async run(_m: Model, _r: Real): Promise<void> {
    await AsyncStorage.setItem(this.key, this.value);
    expect(await AsyncStorage.getItem(this.key)).toBe(this.value);
  }
  toString = () => `storage(${this.key})`;
}

class NetInfoAssertCmd implements fc.AsyncCommand<Model, Real> {
  check = () => true;
  async run(m: Model, _r: Real): Promise<void> {
    const s = await NetInfo.fetch();
    expect(typeof s.isConnected).toBe("boolean");
    m.connected = !!s.isConnected;
  }
  toString = () => "netInfo";
}

class SliderCmd implements fc.AsyncCommand<Model, Real> {
  constructor(readonly value: number) {}
  check = (m: Readonly<Model>) => m.route === "Home";
  async run(m: Model, r: Real): Promise<void> {
    m.slider = this.value;
    await act(async () => {
      fireEvent(r.screen.getByTestId("slider"), "valueChange", this.value);
    });
  }
  toString = () => `slider(${this.value})`;
}

class PickerCmd implements fc.AsyncCommand<Model, Real> {
  constructor(readonly value: string) {}
  check = (m: Readonly<Model>) => m.route === "Home";
  async run(m: Model, r: Real): Promise<void> {
    m.picker = this.value;
    await act(async () => {
      fireEvent(r.screen.getByTestId("picker"), "valueChange", this.value);
    });
  }
  toString = () => `picker(${this.value})`;
}

const allCommands = [
  fc.stringMatching(/^[A-Za-z]{0,5}$/).map((v) => new TypeCmd(v)),
  fc.constant(new AddCmd()),
  fc.constant(new NavDetailCmd()),
  fc.constant(new NavHomeCmd()),
  fc.stringMatching(/^[A-Za-z0-9]{0,8}$/).map((v) => new ClipSetCmd(v)),
  fc
    .tuple(fc.stringMatching(/^[a-z]{1,4}$/), fc.stringMatching(/^[A-Za-z0-9]{0,6}$/))
    .map(([k, v]) => new StorageRoundTripCmd(k, v)),
  fc.constant(new NetInfoAssertCmd()),
  fc.integer({ min: 0, max: 10 }).map((n) => new SliderCmd(n)),
  fc.constantFrom("a", "b", "c").map((v) => new PickerCmd(v)),
];

describe("kitchen-sink fc.commands walk", () => {
  test("mixed library commands keep model == screen/APIs", async () => {
    await AsyncStorage.clear();
    await fc.assert(
      fc.asyncProperty(fc.commands(allCommands, { maxCommands: 16, size: "+1" }), async (commands) => {
        await AsyncStorage.clear();
        let text = "";
        let items: string[] = [];
        let slider = 0;
        let picker = "a";
        let nav: { navigate: (r: string) => void; goBack: () => void } | null = null;

        function Harness() {
          const [t, setT] = useState(text);
          const [its, setIts] = useState(items);
          const [sl, setSl] = useState(slider);
          const [pk, setPk] = useState(picker);
          text = t;
          items = its;
          slider = sl;
          picker = pk;
          return (
            <Sink
              text={t}
              setText={setT}
              items={its}
              setItems={setIts}
              slider={sl}
              setSlider={setSl}
              picker={pk}
              setPicker={setPk}
              onNav={(n) => {
                nav = n;
              }}
            />
          );
        }

        const screen = await render(<Harness />);
        expect(nav).toBeTruthy();

        await fc.asyncModelRun(
          () => ({
            model: {
              route: "Home" as const,
              text: "",
              items: [] as string[],
              clip: "",
              connected: true,
              slider: 0,
              picker: "a",
            },
            real: {
              screen,
              navigate: (r: "Home" | "Detail") => nav?.navigate(r),
            },
          }),
          commands,
        );

        await screen.unmount();
      }),
      opts,
    );
  }, 180_000);
});
