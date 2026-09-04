import type { LibraryShim } from "./helpers.ts";
import { mockBoth, tryRequire } from "./helpers.ts";

export const asyncStorageShim: LibraryShim = {
  name: "async-storage",
  packages: ["@react-native-async-storage/async-storage"],
  register({ cwd, config }) {
    const official =
      tryRequire("@react-native-async-storage/async-storage/jest", cwd) ??
      tryRequire("@react-native-async-storage/async-storage/lib/module/jest/AsyncStorageMock", cwd);

    if (official) {
      mockBoth("@react-native-async-storage/async-storage", () => official, cwd);
      return;
    }

    if (config.debug) {
      console.warn("[rn-bun] async-storage jest mock missing; using Map fallback");
    }

    const store = new Map<string, string>();
    const api = {
      setItem: async (k: string, v: string) => {
        store.set(k, v);
      },
      getItem: async (k: string) => store.get(k) ?? null,
      removeItem: async (k: string) => {
        store.delete(k);
      },
      clear: async () => {
        store.clear();
      },
      getAllKeys: async () => [...store.keys()],
      multiGet: async (keys: string[]) => keys.map((k) => [k, store.get(k) ?? null] as [string, string | null]),
      multiSet: async (pairs: Array<[string, string]>) => {
        for (const [k, v] of pairs) store.set(k, v);
      },
      multiRemove: async (keys: string[]) => {
        for (const k of keys) store.delete(k);
      },
      mergeItem: async (k: string, v: string) => {
        const prev = store.get(k);
        store.set(k, prev ? JSON.stringify({ ...JSON.parse(prev), ...JSON.parse(v) }) : v);
      },
    };
    mockBoth("@react-native-async-storage/async-storage", () => ({ default: api, ...api }), cwd);
  },
};

export const deviceInfoShim: LibraryShim = {
  name: "device-info",
  packages: ["react-native-device-info"],
  register({ cwd, config }) {
    // Official jest mock uses jest.fn — always use a plain fallback under bun:test.
    void config;
    const constants = {
      getUniqueId: async () => "bun-test-unique-id",
      getUniqueIdSync: () => "bun-test-unique-id",
      getBrand: async () => "Apple",
      getBrandSync: () => "Apple",
      getModel: async () => "iPhone",
      getModelSync: () => "iPhone",
      getSystemName: async () => "iOS",
      getSystemNameSync: () => "iOS",
      getSystemVersion: async () => "17.0",
      getSystemVersionSync: () => "17.0",
      getVersion: async () => "1.0.0",
      getVersionSync: () => "1.0.0",
      getBuildNumber: async () => "1",
      getBuildNumberSync: () => "1",
      getBundleId: async () => "com.example.app",
      getBundleIdSync: () => "com.example.app",
      getDeviceId: async () => "iPhone15,2",
      getDeviceIdSync: () => "iPhone15,2",
      isEmulator: async () => true,
      isEmulatorSync: () => true,
      hasNotch: () => true,
      hasDynamicIsland: () => false,
      getTotalMemory: async () => 8 * 1024 ** 3,
      getUsedMemory: async () => 2 * 1024 ** 3,
    };
    mockBoth("react-native-device-info", () => ({ default: constants, ...constants, __esModule: true }), cwd);
  },
};
