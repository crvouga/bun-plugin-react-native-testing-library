# Final report — bun-plugin-react-native-testing-library

## What works

- RNTL 14 async `render` / `fireEvent` under `bun test` with a single `bunfig.toml` preload
- Public `react-native` surface via `mock.module` (View, Text, Pressable, TextInput, FlatList, StyleSheet, Platform, Dimensions, useWindowDimensions, Animated JS driver, …)
- Metro-style platform extension resolution (`.ios` / `.android` / `.native`)
- Asset import stubs
- Flow / Hermes transform via `@react-native/babel-preset` + memory/disk cache (for residual deep loads)
- Unit, property (fast-check ≥100 runs), and spawned-subprocess integration tests
- Example app: Counter, Greeting, TodoList (FlatList mock), ThemedBox + snapshot

## What is stubbed / unsupported

- Animated **native** driver (forced off)
- Real VirtualizedList windowing (FlatList renders all items)
- Native measure APIs (no-ops)
- Bun CJS→ESM live `screen` binding — use `const screen = await render(...)` or `getScreen()`
- Direct `onLoad` of `node_modules/react-native/**` (Bun 1.4.0 #10083 — empty modules)

## Exact versions tested

| Package | Version |
| --- | --- |
| Bun | 1.4.0 |
| react | 19.2.8 |
| react-native | 0.87.1 |
| @testing-library/react-native | 14.0.1 |
| test-renderer | 1.2.0 |
| fast-check | 4.9.0 |
| @babel/core | 7.29.x |
| @react-native/babel-preset | 0.87.1 |

## Test / coverage

```
bun test --coverage
# 43 pass, 0 fail
# All files line coverage: 91.70% (≥ 85% acceptance)
```

## Three most fragile assumptions a Bun upgrade could break

1. **`mock.module` vs runtime `plugin()` ordering** — registering the plugin *before* mocks lets `onResolve` bypass `mock.module("react-native")` and load real Flow sources. Preload must keep mocks-first.
2. **`mock.module` resolution context** — specifier mocks resolve relative to the calling module; preload inside this package must also mock the cwd-absolute `react-native` path or consumers see the real index.js.
3. **Runtime `onLoad` of `node_modules`** — today it fires but ignores returned contents (#10083). If Bun “fixes” this partially or changes `could_be_plugin`, the namespace strategy and smoke probe expectations need re-validation.
