# Final report — bun-plugin-react-native-testing-library

## Status

Real-world React Native library coverage with property-based tests is implemented and green on **Bun 1.4.0**.

## What landed

1. **Full RN public mock** — all ~96 `react-native/index.js` getters plus `Touchable.Mixin` for svg; realistic hosts (Pressable→accessible View, Modal `visible`, SectionList, Animated, EventEmitter family, PanResponder, codegen*, measure* on refs).
2. **`DEEP_PATHS` table** — 30+ `react-native/Libraries/*` specifiers mocked so third-party packages never hit Flow sources.
3. **Library auto-shims** (`libraryMocks: "auto"`) — reanimated, worklets, gesture-handler, safe-area, screens, async-storage, skia, mmkv, device-info, linear-gradient, webview, svg.
4. **Env shims** — `jest.advanceTimersByTimeAsync` (+ friends), `document` / `window.history`, `getScreen()` from cwd.
5. **Tests**
   - Contract: RN exports, deep-imports, matchers, library registry
   - Property: tree, interactions, lists, Animated/APIs, timers, Flow/resolve/assets, render models
   - Sandbox: `test/real-world/` with 18 libraries, property-heavy
   - Integration: spawns sandbox `bun test` (skip via `RN_BUN_SKIP_REAL_WORLD=1`)

## Verification (Bun 1.4.0)

- Root: `bun test` → unit + property + contract + example-app + integration
- Sandbox: `bun run test:real-world` → 19 pass / 0 fail
- No jest/metro in direct dependencies

## Fragile assumptions

- Bun `mock.module` must run **before** `plugin()` for `react-native`
- Bare specifiers still skip runtime `onResolve` — deep paths need explicit `mock.module`
- RNTL named `screen` export stays stale under Bun CJS→ESM
- Skia uses host fallback (CanvasKit init is async)
- Prefer `fireEvent` over `userEvent` in long property loops under Bun fake timers
