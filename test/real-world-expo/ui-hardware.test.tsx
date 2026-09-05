import { describe, expect, test } from "bun:test";
import * as fc from "fast-check";
import { View } from "react-native";
import { render } from "@testing-library/react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { useFonts } from "expo-font";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import * as Haptics from "expo-haptics";

const opts = { numRuns: 15, endOnFailure: true as const };

describe("expo ui + hardware property", () => {
  test("image / gradient / blur / icons render", async () => {
    await fc.assert(
      fc.asyncProperty(fc.stringMatching(/^[A-Za-z]{1,8}$/), async (name) => {
        function FontProbe() {
          const [loaded] = useFonts({ [name]: 1 });
          return <View testID={loaded ? "fonts-ok" : "fonts-pending"} />;
        }
        const screen = await render(
          <View testID="ui">
            <Image testID="img" source={{ uri: "https://example.com/a.png" }} />
            <LinearGradient testID="grad" colors={["#f00", "#00f"]} />
            <BlurView testID="blur" />
            <Ionicons testID="icon" name="home" />
            <FontProbe />
            <CameraView testID="cam" />
          </View>,
        );
        expect(screen.getByTestId("ui")).toBeOnTheScreen();
        expect(screen.getByTestId("img")).toBeOnTheScreen();
        expect(screen.getByTestId("fonts-ok")).toBeOnTheScreen();
        screen.unmount();
      }),
      opts,
    );
  });

  test("camera permissions granted", () => {
    function Probe() {
      const [perm] = useCameraPermissions();
      return <View testID={perm?.granted ? "granted" : "denied"} />;
    }
    return render(<Probe />).then((screen) => {
      expect(screen.getByTestId("granted")).toBeOnTheScreen();
      screen.unmount();
    });
  });

  test("location + notifications + haptics models", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 5 }), async (n) => {
        await Notifications.cancelAllScheduledNotificationsAsync();
        const perm = await Location.requestForegroundPermissionsAsync();
        expect(perm.granted).toBe(true);
        const pos = await Location.getCurrentPositionAsync();
        expect(pos.coords.latitude).toBeCloseTo(37.7749, 3);

        for (let i = 0; i < n; i++) {
          await Notifications.scheduleNotificationAsync({
            content: { title: `t${i}` },
            trigger: null,
          });
        }
        const all = await Notifications.getAllScheduledNotificationsAsync();
        expect(all.length).toBe(n);
        await Notifications.cancelAllScheduledNotificationsAsync();

        await Haptics.selectionAsync();
        expect((Haptics as { __log?: string[] }).__log?.length).toBeGreaterThan(0);
      }),
      opts,
    );
  });
});
