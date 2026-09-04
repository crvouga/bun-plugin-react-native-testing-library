/**
 * Platform mock with real `select` semantics.
 * Attribution: behaviour mirrors react-native/Libraries/Utilities/Platform.*.js (MIT).
 */

import type { Platform as PlatformName } from "../config.ts";

export type PlatformSelectSpec<T> = {
  ios?: T;
  android?: T;
  native?: T;
  default?: T;
  [key: string]: T | undefined;
};

export function createPlatform(platform: PlatformName) {
  const Platform = {
    OS: platform,
    Version: platform === "ios" ? "17.0" : 34,
    isPad: false,
    isTV: false,
    isTesting: true,
    isDisableAnimations: undefined as boolean | undefined,
    constants: {
      forceTouchAvailable: platform === "ios",
      interfaceIdiom: "phone",
      isTesting: true,
      isDisableAnimations: false,
      osVersion: platform === "ios" ? "17.0" : "14",
      reactNativeVersion: { major: 0, minor: 87, patch: 1, prerelease: null as string | null },
      systemName: platform === "ios" ? "iOS" : "Android",
    },
    select<T>(spec: PlatformSelectSpec<T>): T | undefined {
      if (platform in spec && spec[platform] !== undefined) {
        return spec[platform];
      }
      if (spec.native !== undefined) return spec.native;
      return spec.default;
    },
  };
  return Platform;
}
