/**
 * Bridge RNTL's Jest-shaped matchers onto Bun's `expect` types.
 * Runtime registration happens in `src/rntl.ts` via `expect.extend`.
 */
import type { JestNativeMatchers } from "@testing-library/react-native/matchers";

declare module "bun:test" {
  interface Matchers<T = unknown> extends JestNativeMatchers<T> {}
  interface AsymmetricMatchers extends JestNativeMatchers<unknown> {}
}
