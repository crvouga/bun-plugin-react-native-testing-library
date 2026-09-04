/**
 * Expo system / constants / storage behavioral shims (opportunistic).
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { LibraryShim } from "../helpers.ts";
import { mockBoth, packageResolves } from "../helpers.ts";
import { asyncNoop, noop } from "../../mocks/host.ts";

function readAppJson(cwd: string): Record<string, unknown> {
  for (const name of ["app.json", "app.config.json"]) {
    const p = join(cwd, name);
    if (existsSync(p)) {
      try {
        return JSON.parse(readFileSync(p, "utf8")) as Record<string, unknown>;
      } catch {
        // ignore
      }
    }
  }
  return { expo: { name: "ExpoApp", slug: "expo-app", version: "1.0.0" } };
}

export const expoSystemShim: LibraryShim = {
  name: "expo-system",
  packages: ["expo-modules-core"],
  register({ cwd }) {
    const maybe = (spec: string, factory: () => unknown) => {
      if (packageResolves(spec, cwd)) mockBoth(spec, factory, cwd);
    };
    const appJson = readAppJson(cwd);
    const expo = (appJson.expo ?? appJson) as Record<string, unknown>;

    maybe("expo-constants", () => ({
      default: {
        appOwnership: "expo",
        executionEnvironment: "storeClient",
        experienceUrl: "exp://127.0.0.1:8081",
        expoConfig: expo,
        expoGoConfig: null,
        manifest: expo,
        manifest2: null,
        platform: { ios: { buildNumber: "1" }, android: { versionCode: 1 } },
        sessionId: "bun-test-session",
        statusBarHeight: 44,
        systemFonts: [],
        name: expo.name ?? "ExpoApp",
      },
      ExecutionEnvironment: { StoreClient: "storeClient", Standalone: "standalone", Bare: "bare" },
      AppOwnership: { Expo: "expo", Guest: "guest", Standalone: "standalone" },
    }));

    maybe("expo-device", () => ({
      brand: "Apple",
      manufacturer: "Apple",
      modelName: "iPhone",
      modelId: "iPhone15,2",
      deviceName: "iPhone",
      osName: "iOS",
      osVersion: "17.0",
      deviceType: 1,
      DeviceType: { PHONE: 1, TABLET: 2, DESKTOP: 3, TV: 4 },
      isDevice: false,
      getDeviceTypeAsync: async () => 1,
    }));

    maybe("expo-application", () => ({
      applicationId: "com.example.app",
      applicationName: String(expo.name ?? "ExpoApp"),
      nativeApplicationVersion: String(expo.version ?? "1.0.0"),
      nativeBuildVersion: "1",
      getIosIdForVendorAsync: async () => "bun-vendor-id",
      getInstallTimeAsync: async () => new Date(0),
    }));

    maybe("expo-localization", () => ({
      locale: "en-US",
      locales: ["en-US"],
      timezone: "UTC",
      isoCurrencyCodes: ["USD"],
      region: "US",
      isRTL: false,
      getLocales: () => [{ languageTag: "en-US", languageCode: "en", regionCode: "US", textDirection: "ltr" }],
      getCalendars: () => [{ calendar: "gregory", timeZone: "UTC", uses24hourClock: false }],
      useLocales: () => [{ languageTag: "en-US", languageCode: "en", regionCode: "US" }],
      useCalendars: () => [{ calendar: "gregory", timeZone: "UTC" }],
    }));

    const linkingListeners = new Set<(e: { url: string }) => void>();
    maybe("expo-linking", () => ({
      createURL: (path: string) => `yourscheme://${path.replace(/^\//, "")}`,
      resolveScheme: () => "yourscheme",
      parse: (url: string) => ({ path: url, queryParams: {} }),
      parseInitialURLAsync: async () => null,
      getInitialURL: async () => null,
      openURL: asyncNoop,
      openSettings: asyncNoop,
      canOpenURL: async () => true,
      addEventListener: (_type: string, handler: (e: { url: string }) => void) => {
        linkingListeners.add(handler);
        return { remove: () => linkingListeners.delete(handler) };
      },
      sendIntent: asyncNoop,
      collectManifestSchemes: () => ["yourscheme"],
      hasConstantsManifest: () => true,
      makeUrl: (path: string) => `yourscheme://${path}`,
    }));

    const hapticsLog: string[] = [];
    maybe("expo-haptics", () => ({
      notificationAsync: async (type: string) => {
        hapticsLog.push(`notification:${type}`);
      },
      impactAsync: async (style: string) => {
        hapticsLog.push(`impact:${style}`);
      },
      selectionAsync: async () => {
        hapticsLog.push("selection");
      },
      __log: hapticsLog,
      ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
      NotificationFeedbackType: { Success: "success", Warning: "warning", Error: "error" },
    }));

    maybe("expo-updates", () => ({
      isEnabled: false,
      channel: null,
      updateId: null,
      createdAt: null,
      isEmbeddedLaunch: true,
      isEmergencyLaunch: false,
      manifest: null,
      checkForUpdateAsync: async () => ({ isAvailable: false }),
      fetchUpdateAsync: async () => ({ isNew: false }),
      reloadAsync: asyncNoop,
    }));

    let clipboard = "";
    maybe("expo-clipboard", () => ({
      getStringAsync: async () => clipboard,
      setStringAsync: async (v: string) => {
        clipboard = v;
        return true;
      },
      setString: (v: string) => {
        clipboard = v;
      },
      hasStringAsync: async () => clipboard.length > 0,
      addClipboardListener: () => ({ remove: noop }),
      removeClipboardListener: noop,
    }));

    const secure = new Map<string, string>();
    maybe("expo-secure-store", () => ({
      getItemAsync: async (k: string) => secure.get(k) ?? null,
      setItemAsync: async (k: string, v: string) => {
        secure.set(k, v);
      },
      deleteItemAsync: async (k: string) => {
        secure.delete(k);
      },
      isAvailableAsync: async () => true,
      AFTER_FIRST_UNLOCK: 0,
      AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 1,
      ALWAYS: 2,
      WHEN_PASSCODE_SET_THIS_DEVICE_ONLY: 3,
      ALWAYS_THIS_DEVICE_ONLY: 4,
      WHEN_UNLOCKED: 5,
      WHEN_UNLOCKED_THIS_DEVICE_ONLY: 6,
    }));

    let seed = 0x5a17e0e1;
    maybe("expo-crypto", () => ({
      getRandomBytes: (n: number) => {
        const out = new Uint8Array(n);
        for (let i = 0; i < n; i++) {
          seed = (seed * 1664525 + 1013904223) >>> 0;
          out[i] = seed & 0xff;
        }
        return out;
      },
      getRandomBytesAsync: async (n: number) => {
        const out = new Uint8Array(n);
        for (let i = 0; i < n; i++) {
          seed = (seed * 1664525 + 1013904223) >>> 0;
          out[i] = seed & 0xff;
        }
        return out;
      },
      digestStringAsync: async (_alg: string, data: string) => {
        let h = 0;
        for (let i = 0; i < data.length; i++) h = (h * 31 + data.charCodeAt(i)) >>> 0;
        return h.toString(16).padStart(8, "0");
      },
      CryptoDigestAlgorithm: { SHA256: "SHA-256", SHA1: "SHA-1", MD5: "MD5" },
      CryptoEncoding: { HEX: "hex", BASE64: "base64" },
      randomUUID: () => "00000000-0000-4000-8000-000000000001",
    }));
  },
};
