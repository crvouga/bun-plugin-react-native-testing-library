/**
 * Auto-detected third-party library mocks.
 *
 * Each shim activates only when its packages resolve from `process.cwd()`.
 * Controlled by `config.libraryMocks` / `RN_BUN_LIBRARY_MOCKS`.
 */

import type { ResolvedConfig } from "../config.ts";
import type { LibraryShim } from "./helpers.ts";
import { effectiveTargets, packageResolves } from "./helpers.ts";
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
  /** Names held back by the `libraryMocks` filter (kept distinct from failures). */
  filteredOut: string[];
  /** Same-target conflicts that an explicit `override` resolved. */
  overridden: { target: string; winner: string; loser: string }[];
  /** Names skipped through `config.disable`. */
  disabled: string[];
  /** Shims whose activation packages did not all resolve. */
  unavailable: string[];
};

export type RegistrySources = {
  /** Overrides the built-in registry (used by tests and embedders). */
  builtins?: readonly LibraryShim[];
  /** Shims contributed by installed compat packages. */
  packageShims?: readonly LibraryShim[];
  /** Shims contributed by the consumer project. */
  localShims?: readonly LibraryShim[];
  /** Directory for package resolution. Default: process.cwd(). */
  cwd?: string;
};

export type RegistryPlan = {
  /** Shims to register, in deterministic order: builtins -> package -> local. */
  ordered: LibraryShim[];
  /** Names filtered out by `libraryMocks`. */
  filteredOut: string[];
  /** Names skipped through `disable`. */
  disabled: string[];
  /** Names whose activation packages did not all resolve. */
  unavailable: string[];
  /** Same-target claims resolved by an explicit `override`. */
  overridden: { target: string; winner: string; loser: string }[];
  /** Same-target claims resolved without an override (currently empty; kept for reporting). */
  conflicts: { target: string; holder: string; challenger: string }[];
};

function shouldRegister(shim: LibraryShim, option: ResolvedConfig["libraryMocks"]): boolean {
  if (option === false) return false;
  if (option === "auto") return true;
  return option.includes(shim.name);
}

/**
 * Plan the active shim set: built-ins by ascending priority, then package
 * shims, then local shims. Conflict detection runs over declared mock targets
 * (see `effectiveTargets`): two active shims claiming the same target throw,
 * naming both shims, unless the later one declares `override`.
 */
export function resolveRegistry(config: ResolvedConfig, sources: RegistrySources = {}): RegistryPlan {
  const cwd = sources.cwd ?? process.cwd();
  const option = config.libraryMocks;

  if (Array.isArray(option)) {
    const all = [
      ...(sources.builtins ?? LIBRARY_REGISTRY),
      ...(sources.packageShims ?? []),
      ...(sources.localShims ?? []),
    ];
    const known = new Set(all.map((s) => s.name));
    const unknown = option.filter((n) => !known.has(n));
    if (unknown.length > 0) {
      throw new Error(`[rn-bun] Unknown libraryMocks entries: ${unknown.join(", ")}. Known: ${[...known].join(", ")}`);
    }
  }

  const disabled = new Set(config.disable);
  const filteredOut: string[] = [];
  const unavailable: string[] = [];
  const planDisabled: string[] = [];

  const builtinList = (sources.builtins ?? LIBRARY_REGISTRY)
    .map((shim, i) => ({ shim, key: (shim.priority ?? 100) * 10000 + i }))
    .sort((a, b) => a.key - b.key)
    .map((e) => ({ ...e.shim, provenance: e.shim.provenance ?? "builtin" }) as LibraryShim);
  const packageList = (sources.packageShims ?? []).map(
    (shim) => ({ ...shim, provenance: shim.provenance ?? "package" }) as LibraryShim,
  );
  const localList = (sources.localShims ?? []).map(
    (shim) => ({ ...shim, provenance: shim.provenance ?? "local" }) as LibraryShim,
  );

  const ordered: LibraryShim[] = [];
  const claimed = new Map<string, string>();
  const overridden: RegistryPlan["overridden"] = [];
  const conflicts: RegistryPlan["conflicts"] = [];

  const consider = (shim: LibraryShim): void => {
    if (disabled.has(shim.name)) {
      planDisabled.push(shim.name);
      return;
    }
    if (!shouldRegister(shim, option)) {
      filteredOut.push(shim.name);
      return;
    }
    const available = shim.packages.every((p) => packageResolves(p, cwd));
    if (!available) {
      unavailable.push(shim.name);
      return;
    }
    for (const target of effectiveTargets(shim)) {
      const holder = claimed.get(target);
      if (holder != null && holder !== shim.name) {
        if (shim.override) {
          overridden.push({ target, winner: shim.name, loser: holder });
        } else {
          throw new Error(
            `[rn-bun] Shim conflict: "${shim.name}" and "${holder}" both claim target "${target}". ` +
              `Disable one of them via \`disable\`, or set \`override: true\` on "${shim.name}" to replace "${holder}".`,
          );
        }
      }
      if (holder == null || shim.override) claimed.set(target, shim.name);
    }
    ordered.push(shim);
  };

  for (const shim of builtinList) consider(shim);
  for (const shim of packageList) consider(shim);
  for (const shim of localList) consider(shim);

  return { ordered, filteredOut, disabled: planDisabled, unavailable, overridden, conflicts };
}

/**
 * Register library shims that are installed in the consumer project.
 * Throws if `libraryMocks` is a string[] containing unknown registry names,
 * or when two active shims claim the same target without an override.
 */
export function registerLibraryMocks(
  config: ResolvedConfig,
  sources: RegistrySources = {},
): RegisterLibraryMocksResult {
  const plan = resolveRegistry(config, sources);
  const activated: string[] = [];
  const skipped: string[] = [];

  for (const shim of plan.ordered) {
    try {
      shim.register({ config, cwd: process.cwd() });
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

  const skippedAll = [...plan.filteredOut, ...plan.disabled, ...plan.unavailable, ...skipped];
  if (config.debug) {
    console.log(`[rn-bun] libraryMocks activated: [${activated.join(", ")}] skipped: [${skippedAll.join(", ")}]`);
  }

  return {
    activated,
    skipped: skippedAll,
    filteredOut: plan.filteredOut,
    overridden: plan.overridden,
    disabled: plan.disabled,
    unavailable: plan.unavailable,
  };
}

export { LIBRARY_REGISTRY as libraryRegistry };
