/**
 * Expo hardware / permissions behavioral shims (opportunistic).
 */

import type { LibraryShim } from "../helpers.ts";
import { mockBoth, packageResolves } from "../helpers.ts";
import { noop } from "../../mocks/host.ts";

export const expoHardwareShim: LibraryShim = {
  name: "expo-hardware",
  packages: ["expo-modules-core"],
  register({ cwd }) {
    const maybe = (spec: string, factory: () => unknown) => {
      if (packageResolves(spec, cwd)) mockBoth(spec, factory, cwd);
    };

    let locationGranted = true;
    maybe("expo-location", () => ({
      requestForegroundPermissionsAsync: async () => {
        locationGranted = true;
        return { granted: true, status: "granted" };
      },
      getForegroundPermissionsAsync: async () => ({
        granted: locationGranted,
        status: locationGranted ? "granted" : "denied",
      }),
      getCurrentPositionAsync: async () => ({
        coords: {
          latitude: 37.7749,
          longitude: -122.4194,
          altitude: 0,
          accuracy: 5,
          altitudeAccuracy: 5,
          heading: 0,
          speed: 0,
        },
        timestamp: Date.now(),
      }),
      watchPositionAsync: async (_opts: unknown, cb: (loc: unknown) => void) => {
        cb({
          coords: { latitude: 37.7749, longitude: -122.4194, accuracy: 5 },
          timestamp: Date.now(),
        });
        return { remove: noop };
      },
      Accuracy: { Lowest: 1, Low: 2, Balanced: 3, High: 4, Highest: 5, BestForNavigation: 6 },
      PermissionStatus: { GRANTED: "granted", DENIED: "denied", UNDETERMINED: "undetermined" },
    }));

    const scheduled: Array<{ id: string; content: unknown; trigger: unknown }> = [];
    maybe("expo-notifications", () => ({
      getPermissionsAsync: async () => ({ granted: true, status: "granted" }),
      requestPermissionsAsync: async () => ({ granted: true, status: "granted" }),
      scheduleNotificationAsync: async (req: { content: unknown; trigger: unknown }) => {
        const id = `n-${scheduled.length + 1}`;
        scheduled.push({ id, content: req.content, trigger: req.trigger });
        return id;
      },
      cancelScheduledNotificationAsync: async (id: string) => {
        const i = scheduled.findIndex((s) => s.id === id);
        if (i >= 0) scheduled.splice(i, 1);
      },
      cancelAllScheduledNotificationsAsync: async () => {
        scheduled.length = 0;
      },
      getAllScheduledNotificationsAsync: async () => [...scheduled],
      setNotificationHandler: noop,
      addNotificationReceivedListener: () => ({ remove: noop }),
      addNotificationResponseReceivedListener: () => ({ remove: noop }),
      getExpoPushTokenAsync: async () => ({ data: "ExponentPushToken[bun-test]" }),
      __scheduled: scheduled,
    }));

    maybe("expo-image-picker", () => ({
      launchImageLibraryAsync: async () => ({
        canceled: false,
        assets: [{ uri: "file:///tmp/photo.jpg", width: 100, height: 100, type: "image" }],
      }),
      launchCameraAsync: async () => ({
        canceled: false,
        assets: [{ uri: "file:///tmp/camera.jpg", width: 100, height: 100, type: "image" }],
      }),
      requestMediaLibraryPermissionsAsync: async () => ({ granted: true, status: "granted" }),
      requestCameraPermissionsAsync: async () => ({ granted: true, status: "granted" }),
      getMediaLibraryPermissionsAsync: async () => ({ granted: true, status: "granted" }),
      MediaTypeOptions: { All: "All", Images: "Images", Videos: "Videos" },
    }));

    maybe("expo-sensors", () => {
      const make = (name: string) => ({
        addListener: (_cb: (e: unknown) => void) => ({ remove: noop }),
        removeAllListeners: noop,
        setUpdateInterval: noop,
        isAvailableAsync: async () => true,
        __name: name,
      });
      return {
        Accelerometer: make("Accelerometer"),
        Gyroscope: make("Gyroscope"),
        Magnetometer: make("Magnetometer"),
        Barometer: make("Barometer"),
        DeviceMotion: make("DeviceMotion"),
        LightSensor: make("LightSensor"),
        Pedometer: {
          ...make("Pedometer"),
          watchStepCount: () => ({ remove: noop }),
          getStepCountAsync: async () => ({ steps: 0 }),
        },
      };
    });
  },
};
