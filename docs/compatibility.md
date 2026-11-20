# Compatibility coverage

Per-library verdicts from the extensibility audit (Nov 2026). Every claim is backed by an executable test in the fixtures. `bun check` is the canonical release gate; `bun-rn-doctor audit` reports this coverage for any consumer project.

Legend: **behavioral** = the mock models observable native behavior. **presentation** = renders/forwards props only. **chain** = covered by the Expo/RN native-module fallback chain (package mocks + jest-expo definitions tables + generic native-module fallback), no dedicated shim.

## Expo SDK modules (test/real-world-expo)

| Library | Verdict | Evidence |
| --- | --- | --- |
| expo (modules core) | behavioral | `requireNativeModule` chain, seeded module tables (`src/libraries/expo/core.ts`) |
| expo-router | behavioral | `router.test.tsx` — renderRouter, navigation model, property-tested |
| expo-camera | behavioral | hand-written shim surface pinned by `definitions-loader.test.ts` |
| expo-image, expo-av, expo-location, expo-notifications, expo-splash-screen | chain | real-world-expo suite installs and imports them; native-module chain supplies surfaces |
| expo-secure-store, expo-crypto, expo-file-system | behavioral (storage shims) | `storage.test.ts` |
| expo-web-browser, expo-auth-session | behavioral | dedicated shims (`src/libraries/expo/`) |
| expo-haptics, expo-sensors, expo-device, expo-application, expo-constants, expo-font, expo-blur, expo-clipboard | chain | no dedicated shim needed; wrapper APIs resolve through the native-module chain |
| expo-ui | behavioral | dedicated shim + `ui-hardware.test.tsx` |
| expo-sqlite | **uncovered — deferred** | a faithful SQL model is its own project; the official jest-expo mock is also non-behavioral. Track separately before claiming coverage. |

## React Native ecosystem (test/real-world)

| Library | Verdict | Evidence |
| --- | --- | --- |
| reanimated / worklets | behavioral | `reanimated.test.tsx` + property tests (`test:walk`, `test:soak`) |
| gesture-handler | behavioral | `gesture-handler.test.tsx` (official `lib/module/mocks` + GH state) |
| safe-area-context, screens | behavioral | `safe-area.test.tsx`, `navigation.test.tsx` |
| MMKV | behavioral (in-memory KV) | `mmkv.test.tsx` |
| AsyncStorage | behavioral (in-memory KV) | `async-storage.test.tsx` |
| Skia | presentation + core surface | `skia.test.tsx` |
| SVG, WebView, Lottie, maps, video, picker, slider, datetimepicker, clipboard, netinfo, flash-list, pager-view, bottom-sheet, keyboard-controller, moti, fast-image, masked-view | presentation | dedicated shims in `src/libraries/`, exercised by `native-extras.test.tsx` and the oracle corpus |
| firebase (app/auth/firestore/messaging/analytics/crashlytics) | behavioral (in-memory emulators) | dedicated shims with state, keychain-style behavioral smokes in `libraries.test.ts` |
| stripe, google-signin, keychain, biometrics, bootsplash, vision-camera, device-info, config | behavioral or presentation per shim | `src/libraries/ecosystem.ts`, `storage.ts` |
| zustand, @tanstack/react-query, @reduxjs/toolkit, react-hook-form | native (pure JS) | `pure-js.test.tsx` — no shim needed; they run as-is under Bun |
| react-navigation (native stack et al.) | behavioral | `navigation.test.tsx` |

## Known limits

- `InteractionManager` and other RN 0.87/0.88 removals are handled per the Expo SDK 58 matrix (see `scripts/compat/run-matrix.ts` rows).
- Presentation shims do not claim behavior: each carries `surface: "presentation"` in the registry, and `bun-rn-doctor` reports them as presentation.
- Unknown native modules fail loudly through the diagnostics scan; nothing is silently auto-mocked (see `src/diagnostics.ts`).

## Benchmark

`bun run scripts/bench/run-bench.ts` compares the equivalent RNTL operation corpus (test/oracle) under both runners, cold (no transform/jest caches) and warm (caches hot). Latest run (Bun 1.4.4, Linux):

| Suite | Cold | Warm median |
| --- | --- | --- |
| bun plugin (oracle corpus) | 176ms | 171ms |
| jest-expo (oracle corpus) | 129ms | 1491ms |
| **speedup** | 0.73x | **8.72x** |

Context: the full Expo fixture suite runs cold in 456ms under the plugin (bun-only number; no jest-side equivalent exists in this repo). The cold number is honest: bun rebuilds the RN Flow transform cache from scratch, while a single-test jest process starts fast. Real-world warm reruns — the common case in development — see the multi-x advantage. Results are record-only; the differential oracle remains the release gate. Full reports land in `.compat-out/bench-report.json`.
