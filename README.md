# bun-plugin-react-native-testing-library

[![CI](https://github.com/crvouga/bun-plugin-react-native-testing-library/actions/workflows/ci.yml/badge.svg)](https://github.com/crvouga/bun-plugin-react-native-testing-library/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/bun-plugin-react-native-testing-library.svg)](https://www.npmjs.com/package/bun-plugin-react-native-testing-library)

Bun runtime plugin that makes [`@testing-library/react-native`](https://callstack.github.io/react-native-testing-library/) (RNTL) work under **`bun test`** with **zero Jest** and **zero Metro**.

Requires [Bun](https://bun.sh) `>=1.4.0`. Publishes TypeScript sources (no compile step) — Bun loads them directly.

Repository: https://github.com/crvouga/bun-plugin-react-native-testing-library

## Install

```bash
bun add -d bun-plugin-react-native-testing-library \
  @testing-library/react-native test-renderer \
  react react-native
```

**Peer dependencies** (install in the consumer):

| Package | Range |
| --- | --- |
| `@testing-library/react-native` | `>=14.0.0` |
| `react` | `>=19.0.0` |
| `react-native` | `>=0.78.0` |
| `test-renderer` | `>=1.0.0` |

## Quick start

Add a preload line to `bunfig.toml` (see also [`bunfig.example.toml`](bunfig.example.toml)):

```toml
[test]
preload = ["bun-plugin-react-native-testing-library/preload"]
```

Write RNTL tests as usual. **RNTL v14 is async** — prefer the render return value (Bun's CJS→ESM interop does not live-update the named `screen` export):

```tsx
import { test, expect } from "bun:test";

import { Text, View } from "react-native";
import { render, fireEvent } from "@testing-library/react-native";

test("hello", async () => {
  const screen = await render(
    <View>
      <Text>hi</Text>
    </View>,
  );
  expect(screen.getByText("hi")).toBeOnTheScreen();
});
```

Optional live `screen` helper if you need it:

```ts
import { getScreen } from "bun-plugin-react-native-testing-library/screen";
```

## Package exports

| Export | Path | Purpose |
| --- | --- | --- |
| `.` | `createReactNativePlugin` (default) | Plugin factory for advanced / custom preload |
| `./preload` | side-effect entry | Drop-in `bunfig.toml` preload (recommended) |
| `./screen` | `getScreen()` | Live RNTL `screen` accessor when the named export is stale |

Advanced usage without the preload entry:

```ts
import { plugin } from "bun";
import { createReactNativePlugin } from "bun-plugin-react-native-testing-library";

plugin(createReactNativePlugin({ platform: "ios", debug: true }));
```

## Compatibility

| Tool | Tested version |
| --- | --- |
| Bun | **1.4.0** (`engines.bun: ">=1.4.0"`) |
| react | 19.2.8 |
| react-native | 0.87.1 |
| @testing-library/react-native | 14.0.1 |
| test-renderer | 1.2.x |
| fast-check | 4.9.x |

No `jest`, `jest-expo`, or `metro` packages appear in this package's direct `dependencies` / `devDependencies`. Transitive peers may still pull `metro-runtime` (via `react-native`) and `jest-matcher-utils` (via RNTL).

## Options

Configure via `createReactNativePlugin(options)`, env vars, or optional `./rn-bun.config.ts` in the consumer cwd.

| Option | Env | Default | Description |
| --- | --- | --- | --- |
| `platform` | `RN_BUN_PLATFORM` | `"ios"` | Metro platform for `.ios` / `.android` / `.native` resolution |
| `assetExts` | — | png, jpg, … | Extensions stubbed as `{ uri, testUri, width, height, scale }` |
| `include` | — | `react-native` + a few `@react-native/*` | Absolute-path substrings eligible for Flow transform |
| `exclude` | — | babel/codegen tooling | Paths never transformed |
| `cacheDir` | `RN_BUN_CACHE_DIR` | `.rn-bun-cache` | Disk cache for Flow transforms |
| `debug` | `RN_BUN_DEBUG=1` | `false` | Log cache hits/misses and transform times |
| `window` | — | `{390,844,3,1}` | `Dimensions` / `useWindowDimensions` metrics |
| `strategy` | `RN_BUN_STRATEGY` | `"auto"` → `"namespace"` | How to intercept RN sources (see pitfall below) |
| `libraryMocks` | `RN_BUN_LIBRARY_MOCKS` | `"auto"` | Auto-register third-party library shims when packages resolve (`false` / comma-separated names to filter) |

## Third-party library compatibility

When a package is installed in the consumer, preload auto-registers a shim (`libraryMocks: "auto"`). Proven in [`test/real-world/`](test/real-world/) against the versions below.

Fail-closed scanners (`test/contract/deep-path-inventory.test.ts`, `test/contract/import-surface.test.ts`) walk the sandbox catalog: every deep `react-native/Libraries|src/...` import must be in `DEEP_PATHS`, and every catalog package must `require` to a non-empty module with documented exports.

| Library | Strategy | Version tested | Notes |
| --- | --- | --- | --- |
| `react-native-reanimated` | mutable JS fallback | 4.6.0 | Official mock is non-extensible; GH assigns `setGestureState` |
| `react-native-worklets` | JS fallback | 0.12.1 | `runOnJS` / `runOnUI` passthrough |
| `react-native-gesture-handler` | View root + official `lib/module/mocks/*` | 3.2.1 | Root always mocked (avoids `__DEV__` / native) |
| `react-native-safe-area-context` | official jest mock | 5.9.1 | |
| `react-native-screens` | View passthrough shim | 4.27.0 | `screensEnabled() => false` |
| `@react-navigation/*` | no shim (uses screens + safe-area) | 7.x | Needs `window.history` / `document` stubs (preload) |
| `@react-native-async-storage/async-storage` | official `./jest` | 3.1.1 | In-memory |
| `react-native-svg` | host-component shim | 15.15.5 | Real JS often hits Flow `typeof` under Bun |
| `@shopify/react-native-skia` | host-component fallback | 2.11.2 | CanvasKit WASM init is async; sync preload uses View hosts |
| `react-native-mmkv` | in-memory + hooks | 4.3.2 | Nitro path mocked |
| `react-native-webview` | View host shim | 14.0.1 | Platform entry unsupported under Bun |
| `react-native-linear-gradient` | View shim | 2.8.3 | `import { type }` in `.ios.js` rejected by Bun |
| `react-native-device-info` | constants fallback | 15.0.2 | Official mock needs `jest.fn` |
| `@react-native-community/netinfo` | in-memory connectivity | 11.4.1 | |
| `@react-native-clipboard/clipboard` | string model | 1.16.3 | |
| `@react-native-community/datetimepicker` | View host | 8.6.0 | |
| `@react-native-community/slider` | View host | 5.1.2 | |
| `@react-native-picker/picker` | View host + Item | 2.11.4 | |
| `@shopify/flash-list` | map-all-rows (like FlatList) | 2.2.0 | |
| `react-native-pager-view` | View host + `setPage` | 6.9.1 | |
| `lottie-react-native` | View host | 7.3.4 | |
| `react-native-fast-image` | Image host | 8.6.3 | |
| `react-native-permissions` | granted-by-default | 5.4.4 | |
| `react-native-localize` | constants | 3.6.1 | |
| `react-native-get-random-values` | `crypto.getRandomValues` | 1.11.0 | |
| `react-native-url-polyfill` | real JS | 3.0.0 | |
| `@react-native-masked-view/masked-view` | View host | 0.3.2 | |
| `react-native-keyboard-controller` | host + passthrough hooks | 1.20.7 | |
| `moti` | View host (`MotiView`) | 0.30.0 | |
| `react-native-modal` | real JS | 13.0.2 | |
| `@gorhom/bottom-sheet` | View host + provider | 5.2.8 | |
| `react-native-paper` | no shim | 5.15.3 | |
| `i18next` / `react-i18next` | no shim | current | Pure JS |
| `zustand` / `@tanstack/react-query` / RTK / `react-hook-form` | no shim | current | Pure JS |

### Expo SDK 57

Proven in [`test/real-world-expo/`](test/real-world-expo/). Requires `expo-modules-core` (and optionally `jest-expo` for the native-module mock table).

| Library | Strategy | Notes |
| --- | --- | --- |
| `expo-modules-core` | jest-expo-compatible `requireNativeModule` + `globalThis.expo` polyfill | Auto-proxy when table/package mock missing |
| `expo-constants` / `expo-device` / `expo-application` / `expo-localization` | constants from `app.json` | |
| `expo-secure-store` / `expo-clipboard` / `expo-crypto` | in-memory / seeded | |
| `expo-file-system` | in-memory VFS (+ legacy API) | |
| `expo-sqlite` | `bun:sqlite` memory DBs | |
| `expo-image` / `expo-linear-gradient` / `expo-blur` / `@expo/vector-icons` / `expo-font` | host / Text shims | |
| `expo-camera` / `expo-location` / `expo-notifications` / `expo-image-picker` / `expo-sensors` / `expo-haptics` | granted permissions + deterministic models | |
| `expo-av` / `expo-audio` / `expo-splash-screen` / `expo-status-bar` / `expo-updates` / `expo-linking` | behavioral stubs | |
| `expo-router` | real package + `testing-library` `renderRouter` | In-memory routes; file-based `app/` not required |

```bash
bun test                       # all suites incl. real-world + expo (spawned) — fail-fast
bun run check                  # format + lint + typecheck + test + canaries
bun run test:real-world
bun run test:real-world-expo
bun run test:canaries          # deliberate sabotages must fail probes
bun run test:walk              # fc.commands soak (root + sandbox)
bun run test:soak
RN_BUN_SKIP_REAL_WORLD=1 bun test
```

Property / model-based tests use `fast-check` (`fc.commands` / `asyncModelRun` for stateful walks). Tune with `RN_BUN_FC_RUNS` / `RN_BUN_FC_SEED`.

## Architecture

```
bunfig preload
  → globals (__DEV__, IS_REACT_ACT_ENVIRONMENT, rAF, document/history, jest async timer shims)
  → mock.module("react-native") + DEEP_PATHS (Libraries/*)
  → registerLibraryMocks (auto-detect)
  → plugin(createReactNativePlugin)
       → onResolve: Metro platform extensions + optional rn-flow: rewrite
       → onLoad: Flow/Hermes transform (cached) + asset stubs
```

**Mocks are registered before the plugin.** On Bun 1.4.0, installing the runtime plugin first lets `onResolve` intercept `react-native` and bypass subsequent `mock.module` registrations.

**React is resolved from `process.cwd()`** inside the public-API mock so host components share the consumer's React copy (avoids "Invalid hook call" when this package is linked via `file:`).

## The node_modules `onLoad` pitfall (oven-sh/bun#10083)

Smoke probe result on Bun **1.4.0** (see `test/integration/smoke-onload-result.json`):

- A direct `onLoad` filter on `node_modules/**` **does fire**, but returned contents are **ignored** → empty/undefined exports (`Module {}` symptom).
- Bare package specifiers **do not** trigger runtime `onResolve` (`could_be_plugin` gate requires `.` or `:` in the specifier).
- Therefore this plugin:
  1. **Primary:** `mock.module("react-native")` (+ cwd-absolute path) providing a behaviour-minimal public API.
  2. **Residual:** `strategy: "namespace"` rewrite into `rn-flow:` + `onLoad` for deep Flow sources that still need transforming.
  3. Asset stubs + Metro platform resolution for **user** code.

## Known unsupported / stubbed surface

| Surface | Behaviour |
| --- | --- |
| Animated native driver | Forced off (`shouldUseNativeDriver` → `false`); JS driver only |
| Real `VirtualizedList` virtualization | Lists render all rows (map-style); fine for unit tests |
| Skia CanvasKit WASM | Sync preload uses host-component fallback |
| Named `import { screen }` live binding | Broken under Bun CJS→ESM; use `await render(...)` return or `getScreen()` |
| `jest.mock()` | Unsupported — use `mock.module` or `libraryMocks` |
| `userEvent` + fake timers | Prefer `fireEvent` in property loops; restore `jest.useRealTimers()` after userEvent |

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `Unexpected typeof` / Flow parse errors from `react-native/index.js` | Preload not active, or plugin registered before mocks. Ensure `bunfig.toml` preload path resolves and you are on Bun ≥ 1.4.0 |
| Empty `Module {}` / undefined exports from RN | Do **not** rely on direct `onLoad` of `node_modules`. Keep `strategy` at `namespace`/`auto` and the public-API mock |
| `Invalid hook call` | Dual React copies — usually a `file:` link without cwd React resolution (fixed in this package); ensure the consumer has a single `react` |
| `` `render` function has not been called `` on `screen` | Use the return value of `await render(...)` or `getScreen()` |
| Matchers missing | Import from `@testing-library/react-native` (not `/pure`), or `expect.extend(require("…/matchers"))` |
| `window.history.state` / `document is not defined` | Ensure preload is active (stubs provided) |

## CI matrix note

Pin Bun in CI (this repo was verified on **1.4.0**). Re-run `test/integration/smoke-onload.test.ts` when upgrading Bun — if direct `onLoad` of `node_modules` starts returning transformed contents, you may set `RN_BUN_STRATEGY=direct`, but the public-API `mock.module` path remains the recommended default.

## Development

```bash
bun install
bun run check:full        # local replica of CI (except release)
bun run check             # format + lint + typecheck + all tests + canaries
bun test                  # fail-fast suite (includes real-world + expo spawns)
bun test --coverage
bun run verify-package    # npm pack integrity + publint
```

Property tests use `fast-check` (`fc.commands` / `asyncModelRun` for model-based walks; `RN_BUN_FC_RUNS`, default 40–100; `RN_BUN_FC_SEED` for replay).
`bun run test:canaries` applies deliberate sabotages to mocks and asserts focused probes fail.
`bun run test:walk` soaks the root + sandbox command walks.

## Releasing

Publishing is fully automated. You never bump `version` or run `npm publish` by hand.

### How a release happens

1. Push or merge to `main`. Prefer [Conventional Commits](https://www.conventionalcommits.org/) so the bump is `feat` → minor / `fix` → patch / `BREAKING` → major; any other subject still publishes a patch.
2. CI runs commitlint, format/lint/typecheck, package verification, tests, and canaries.
3. If every gate is green, the release job seeds the npm package if it is missing, then [semantic-release](https://semantic-release.gitbook.io/) analyzes commits since the last git tag, bumps semver, publishes to npm, and creates a GitHub Release.

| Commit | Version bump |
| --- | --- |
| `fix: …` / `perf: …` | patch (`1.9.0` → `1.9.1`) |
| `feat: …` | minor (`1.9.0` → `1.10.0`) |
| `feat!: …` or `BREAKING CHANGE:` footer | major (`1.10.0` → `2.0.0`) |
| any other message on `main` (including Cursor-style subjects) | patch |

Examples:

```text
feat: add expo-router shim
fix: correct Flow transform cache key
feat!: rename createReactNativePlugin options

Refactor mock registration order   # still publishes a patch
```

PR titles must also follow Conventional Commits (enforced in CI). Prefer squash merges with a conventional title.

Local checks:

```bash
bun run check:full             # commitlint + quality + tests + canaries
# dry-run needs a GitHub token for API calls; CI publish uses Trusted Publishing (no NPM_TOKEN after seed)
bun run release:dry-run
```

`package.json` version is `0.0.0-development` on purpose — **git tags** (`v0.1.0`, …) are the source of truth.

### One-time setup (maintainers)

Do this once so CI can publish. Full checklist: **[docs/SECRETS.md](./docs/SECRETS.md)**.

1. **Create the package on npm (once), then Trusted Publishing.** If https://www.npmjs.com/package/bun-plugin-react-native-testing-library 404s:

   ```bash
   npm login --auth-type=web
   bun run npm:seed -- --yes
   ```

   npm does not email a publish code — complete 2FA in the browser or authenticator app.

   Alternatively, set a short-lived `NPM_TOKEN` Actions secret; the release job runs `bun run npm:seed -- --ci` and publishes `0.1.0`. Delete the token afterward.

   Then on [package Access](https://www.npmjs.com/package/bun-plugin-react-native-testing-library/access) → Trusted Publisher → GitHub Actions (`crvouga/bun-plugin-react-native-testing-library`, workflow `ci.yml`). Do **not** create an Automation / granular access token for steady-state CI.
2. Confirm GitHub Actions is enabled and can create releases (default `GITHUB_TOKEN` is enough with this workflow’s permissions). No long-lived `NPM_TOKEN` repo secret.
3. Ensure the baseline tag exists and is pushed: `v0.1.0` (semver continues from there; the next `feat` publishes `0.2.0`).

Validate the checklist anytime with `bun run secrets:doctor`.

After that, every green push to `main` updates npm automatically (`feat`/`fix`/`BREAKING` pick the bump; anything else is a patch).

## License

MIT
