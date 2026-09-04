# bun-plugin-react-native-testing-library

Bun runtime plugin that makes [`@testing-library/react-native`](https://callstack.github.io/react-native-testing-library/) (RNTL) work under **`bun test`** with **zero Jest** and **zero Metro**.

Repository: https://github.com/crvouga/bun-plugin-react-native-testing-library.git

## Quick start

```bash
bun add -d bun-plugin-react-native-testing-library \
  @testing-library/react-native test-renderer \
  react react-native
```

Add a preload line to `bunfig.toml` (see also [`bunfig.example.toml`](bunfig.example.toml)):

```toml
[test]
preload = ["bun-plugin-react-native-testing-library/preload"]
```

Write RNTL tests as usual. **RNTL v14 is async** — prefer the render return value (Bun's CJS→ESM interop does not live-update the named `screen` export):

```tsx
import { test, expect } from "bun:test";
import * as React from "react";
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

## Architecture

```
bunfig preload
  → globals (__DEV__, IS_REACT_ACT_ENVIRONMENT, rAF, jest shims)
  → mock.module("react-native")  // public API (host components + Platform/…)
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
| Real `VirtualizedList` virtualization | `FlatList` mock renders all rows (map-style); fine for unit tests |
| Native layout measurement | `UIManager.measure*` are no-ops |
| Named `import { screen }` live binding | Broken under Bun CJS→ESM; use `const screen = await render(...)` or `getScreen()` |
| Full RN public API | Common testing surface is mocked; exotic modules may still need custom `mock.module` |

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `Unexpected typeof` / Flow parse errors from `react-native/index.js` | Preload not active, or plugin registered before mocks. Ensure `bunfig.toml` preload path resolves and you are on Bun ≥ 1.4.0 |
| Empty `Module {}` / undefined exports from RN | Do **not** rely on direct `onLoad` of `node_modules`. Keep `strategy` at `namespace`/`auto` and the public-API mock |
| `Invalid hook call` | Dual React copies — usually a `file:` link without cwd React resolution (fixed in this package); ensure the consumer has a single `react` |
| `` `render` function has not been called `` on `screen` | Use the return value of `await render(...)` |
| Matchers missing | Import from `@testing-library/react-native` (not `/pure`), or `expect.extend(require("…/matchers"))` |

## CI matrix note

Pin Bun in CI (this repo was verified on **1.4.0**). Re-run `test/integration/smoke-onload.test.ts` when upgrading Bun — if direct `onLoad` of `node_modules` starts returning transformed contents, you may set `RN_BUN_STRATEGY=direct`, but the public-API `mock.module` path remains the recommended default.

## Development

```bash
bun install
bun test
bun test --coverage
```

Property tests use `fast-check` with `numRuns >= 100` and seed `0x5a17e0e1` (override with `RN_BUN_FC_SEED`).

## License

MIT
