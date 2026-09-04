/**
 * Register mocks via Bun's `mock.module()`.
 *
 * Primary strategy (Bun 1.4.0): replace the public `react-native` entry.
 * Direct onLoad of node_modules yields empty Module {} (#10083), and bare
 * specifiers skip runtime onResolve — so Flow transform never reaches index.js.
 *
 * Important: `mock.module("react-native")` resolves the specifier relative to
 * the module that *calls* it. When preload lives inside this package (or is
 * loaded via an absolute path into this package), that resolution hits *this*
 * package's nested `node_modules/react-native`, not the consumer's. Always
 * also mock the absolute path resolved from `process.cwd()`.
 */

import { mock } from "bun:test";
import type { ResolvedConfig } from "../config.ts";
import { createReactNativePublicAPI } from "./react-native.ts";

function mockReactNative(factory: () => unknown): void {
  mock.module("react-native", factory);
  try {
    const abs = Bun.resolveSync("react-native", process.cwd());
    mock.module(abs, factory);
  } catch {
    // consumer may not have react-native installed yet
  }
}

function tryMock(specifier: string, factory: () => unknown): void {
  try {
    mock.module(specifier, factory);
  } catch {
    // ignore
  }
  try {
    const abs = Bun.resolveSync(specifier, process.cwd());
    mock.module(abs, factory);
  } catch {
    // ignore
  }
}

export function registerMocks(config: ResolvedConfig): void {
  const publicAPI = createReactNativePublicAPI(config);

  mockReactNative(() => publicAPI);

  // Deep entry points some libraries import directly — map to the public mock
  // so they never hit Flow-typed sources. Always resolve from cwd.
  tryMock("react-native/setup-env", () => ({}));
  tryMock("react-native/Libraries/Components/View/View", () => ({
    default: publicAPI.View,
  }));
  tryMock("react-native/Libraries/Text/Text", () => ({
    default: publicAPI.Text,
  }));
  tryMock("react-native/Libraries/Components/TextInput/TextInput", () => ({
    default: publicAPI.TextInput,
  }));
  tryMock("react-native/Libraries/Image/Image", () => ({
    default: publicAPI.Image,
  }));
  tryMock("react-native/Libraries/Components/ScrollView/ScrollView", () => ({
    default: publicAPI.ScrollView,
  }));
  tryMock("react-native/Libraries/Lists/FlatList", () => ({
    default: publicAPI.FlatList,
  }));
  tryMock("react-native/Libraries/Utilities/Platform", () => ({
    default: publicAPI.Platform,
    ...publicAPI.Platform,
  }));
  tryMock("react-native/Libraries/Utilities/Dimensions", () => ({
    default: publicAPI.Dimensions,
    ...publicAPI.Dimensions,
  }));
  tryMock("react-native/Libraries/StyleSheet/StyleSheet", () => ({
    default: publicAPI.StyleSheet,
    ...publicAPI.StyleSheet,
  }));
  tryMock("react-native/Libraries/BatchedBridge/NativeModules", () => ({
    default: publicAPI.NativeModules,
  }));
  tryMock("react-native/Libraries/TurboModule/TurboModuleRegistry", () => ({
    default: publicAPI.TurboModuleRegistry,
    ...publicAPI.TurboModuleRegistry,
  }));
  tryMock("react-native/Libraries/ReactNative/UIManager", () => ({
    default: publicAPI.UIManager,
    ...publicAPI.UIManager,
  }));
  tryMock("react-native/Libraries/Animated/NativeAnimatedHelper", () => ({
    default: {
      shouldUseNativeDriver: () => false,
      assertNativeAnimatedModule: () => {},
      isNativeAnimatedModuleAvailable: false,
    },
  }));
}
