/**
 * Auto-detected third-party library mocks.
 *
 * Each shim activates only when its packages resolve from `process.cwd()`.
 * Controlled by `config.libraryMocks` / `RN_BUN_LIBRARY_MOCKS`.
 */

import type { ResolvedConfig } from "../config.ts";
import type { LibraryShim } from "./helpers.ts";
import { packageResolves } from "./helpers.ts";
import { gestureHandlerShim } from "./gesture-handler.ts";
import { safeAreaShim, screensShim } from "./navigation.ts";
import { reanimatedShim, workletsShim } from "./reanimated.ts";
import { skiaShim, mmkvShim } from "./skia-mmkv.ts";
import { asyncStorageShim, deviceInfoShim } from "./storage.ts";
import { linearGradientShim, svgShim, webviewShim } from "./extras.ts";
import {
  expoCoreShim,
  expoUiShim,
  expoSystemShim,
  expoHardwareShim,
  expoDataShim,
  expoWebBrowserShim,
  expoAuthSessionShim,
} from "./expo/index.ts";
import {
  netinfoShim,
  clipboardShim,
  datetimepickerShim,
  sliderShim,
  pickerShim,
  flashListShim,
  pagerViewShim,
  lottieShim,
  fastImageShim,
  permissionsShim,
  localizeShim,
  getRandomValuesShim,
  maskedViewShim,
  keyboardControllerShim,
  motiShim,
  bottomSheetShim,
} from "./native-extras.ts";
import {
  mapsShim,
  videoShim,
  imagePickerShim,
  shareShim,
  bootsplashShim,
  keychainShim,
  biometricsShim,
  configShim,
  visionCameraShim,
  firebaseAppShim,
  firebaseAuthShim,
  firebaseFirestoreShim,
  firebaseMessagingShim,
  firebaseAnalyticsShim,
  firebaseCrashlyticsShim,
  googleSigninShim,
  stripeShim,
} from "./ecosystem.ts";

export const LIBRARY_REGISTRY: readonly LibraryShim[] = [
  workletsShim,
  reanimatedShim,
  gestureHandlerShim,
  safeAreaShim,
  screensShim,
  asyncStorageShim,
  skiaShim,
  mmkvShim,
  deviceInfoShim,
  linearGradientShim,
  webviewShim,
  svgShim,
  netinfoShim,
  clipboardShim,
  datetimepickerShim,
  sliderShim,
  pickerShim,
  flashListShim,
  pagerViewShim,
  lottieShim,
  fastImageShim,
  permissionsShim,
  localizeShim,
  getRandomValuesShim,
  maskedViewShim,
  keyboardControllerShim,
  motiShim,
  bottomSheetShim,
  mapsShim,
  videoShim,
  imagePickerShim,
  shareShim,
  bootsplashShim,
  keychainShim,
  biometricsShim,
  configShim,
  visionCameraShim,
  firebaseAppShim,
  firebaseAuthShim,
  firebaseFirestoreShim,
  firebaseMessagingShim,
  firebaseAnalyticsShim,
  firebaseCrashlyticsShim,
  googleSigninShim,
  stripeShim,
  expoCoreShim,
  expoUiShim,
  expoSystemShim,
  expoHardwareShim,
  expoDataShim,
  expoWebBrowserShim,
  expoAuthSessionShim,
];

export type RegisterLibraryMocksResult = {
  activated: string[];
  skipped: string[];
};

function shouldRegister(shim: LibraryShim, option: ResolvedConfig["libraryMocks"]): boolean {
  if (option === false) return false;
  if (option === "auto") return true;
  return option.includes(shim.name);
}

/**
 * Register library shims that are installed in the consumer project.
 * Throws if `libraryMocks` is a string[] containing unknown registry names.
 */
export function registerLibraryMocks(config: ResolvedConfig): RegisterLibraryMocksResult {
  const cwd = process.cwd();
  const option = config.libraryMocks;

  if (Array.isArray(option)) {
    const known = new Set(LIBRARY_REGISTRY.map((s) => s.name));
    const unknown = option.filter((n) => !known.has(n));
    if (unknown.length > 0) {
      throw new Error(`[rn-bun] Unknown libraryMocks entries: ${unknown.join(", ")}. Known: ${[...known].join(", ")}`);
    }
  }

  const activated: string[] = [];
  const skipped: string[] = [];

  for (const shim of LIBRARY_REGISTRY) {
    if (!shouldRegister(shim, option)) {
      skipped.push(shim.name);
      continue;
    }
    const available = shim.packages.every((p) => packageResolves(p, cwd));
    if (!available) {
      skipped.push(shim.name);
      continue;
    }
    try {
      shim.register({ config, cwd });
      activated.push(shim.name);
    } catch (err) {
      if (config.debug) {
        console.warn(
          `[rn-bun] Failed to register library shim "${shim.name}":`,
          err instanceof Error ? err.message : err,
        );
      }
      skipped.push(shim.name);
    }
  }

  if (config.debug) {
    console.log(`[rn-bun] libraryMocks activated: [${activated.join(", ")}] skipped: [${skipped.join(", ")}]`);
  }

  return { activated, skipped };
}

export { LIBRARY_REGISTRY as libraryRegistry };
