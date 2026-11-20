# Migrating Jest suites to Bun

Existing Jest (jest-expo) test files mostly run unchanged: `describe`/`it`/`test`, `expect`, hooks, mocks with factories, fake timers, and snapshots work under `bun test` with this plugin preloaded. This page lists the differences that actually bite, each backed by an executable test in `test/contract/jest-compat.test.tsx`.

## What just works

- `jest.fn()`, `jest.spyOn()`, `mockImplementation`/`mockReturnValue` on mock functions.
- `jest.useFakeTimers()` + `jest.advanceTimersByTimeAsync()` (shimmed; see `jest-compat: timers` tests).
- `jest.setSystemTime()`, `jest.getRealSystemTime()`.
- `jest.requireActual()` / `jest.requireMock()` — resolved relative to the calling file (shimmed).
- `jest.mock(path, factory)` — delegates to bun's module mocking; the factory is applied.
- Snapshot testing (`toMatchSnapshot`), including React render trees.
- RNTL `render`/`fireEvent`/`waitFor`, `screen` via the render return value.

## Differences

| Jest behavior | Under Bun | Test |
| --- | --- | --- |
| `jest.mock(path)` without a factory automocks | Throws with guidance: pass a factory, or use `mock.module(path, factory)` from `bun:test`. A silent automock would hide real failures. | `bare jest.mock (no factory) fails loudly` |
| `jest.resetModules()` clears the module registry | No bun equivalent (the registry is not resettable). Throws with the fix: split isolated suites into separate files, or re-register modules with `mock.module`. | `resetModules fails loudly` |
| Module state resets between tests when combined with `resetModules` | Module state persists per file. Isolate per file; state persistence itself is asserted in `module state persists across requires`. | `module state persists` |
| `jest.mock` calls are hoisted above imports | Bun evaluates `jest.mock` in place — call it at the top of the file, before importing the mocked module. | covered by the factory delegation test |
| Fake timers advance `setImmediate` | `setImmediate` stays real under bun's fake timers (bun default). Use `setTimeout`-based waits or advance with `advanceTimersByTimeAsync`. | timers tests |
| Named `screen` export stays fresh | Async RNTL `render()` means the re-exported `screen` can go stale; prefer the render return value or `getScreen()` from `.../screen`. | documented in README Quick start |
| Snapshot serialization | Bun's snapshot format is Jest-compatible for trees; regenerated snapshots may differ in formatting. Review `--update-snapshots` diffs once on first migration. | `RN render snapshot writes and matches` |

## Recommended preload

```toml
[test]
preload = ["bun-plugin-react-native-testing-library/preload"]
```

Then run `bun test` as usual. If a suite still reaches for Jest-only surface, `bun-rn-doctor audit` tells you which compatibility pieces are active and which dependency needs a shim.
