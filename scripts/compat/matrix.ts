/**
 * Declared compatibility matrix for npm-pack clean consumers.
 *
 * Full behavioral rows install RN/React/Test Renderer aligned triples.
 * Light rows only verify import/export resolution for intervening RN minors.
 */

export type MatrixRow = {
  id: string;
  kind: "full" | "light";
  bun?: string;
  platform: "ios" | "android";
  reactNative: string;
  react: string;
  testRenderer: string;
  rntl: string;
};

/** Official alignment triples (RN + React + test-renderer). */
export const FULL_ROWS: readonly MatrixRow[] = [
  {
    id: "rn078-rntl140-ios",
    kind: "full",
    platform: "ios",
    reactNative: "0.78.3",
    react: "19.0.0",
    testRenderer: "1.0.0",
    rntl: "14.0.0",
  },
  {
    id: "rn082-rntl141-android",
    kind: "full",
    platform: "android",
    reactNative: "0.82.1",
    react: "19.1.0",
    testRenderer: "1.1.0",
    rntl: "14.0.1",
  },
  {
    id: "rn087-rntl141-ios",
    kind: "full",
    platform: "ios",
    reactNative: "0.87.1",
    react: "19.2.8",
    testRenderer: "1.2.0",
    rntl: "14.0.1",
  },
];

/** Intervening RN minors — lightweight import/export only. */
export const LIGHT_ROWS: readonly MatrixRow[] = [
  {
    id: "rn079-light-ios",
    kind: "light",
    platform: "ios",
    reactNative: "0.79.6",
    react: "19.0.0",
    testRenderer: "1.0.0",
    rntl: "14.0.1",
  },
  {
    id: "rn080-light-ios",
    kind: "light",
    platform: "ios",
    reactNative: "0.80.2",
    react: "19.1.0",
    testRenderer: "1.1.0",
    rntl: "14.0.1",
  },
  {
    id: "rn081-light-ios",
    kind: "light",
    platform: "ios",
    reactNative: "0.81.5",
    react: "19.1.0",
    testRenderer: "1.1.0",
    rntl: "14.0.1",
  },
  {
    id: "rn083-light-ios",
    kind: "light",
    platform: "ios",
    reactNative: "0.83.1",
    react: "19.1.0",
    testRenderer: "1.1.0",
    rntl: "14.0.1",
  },
  {
    id: "rn084-light-ios",
    kind: "light",
    platform: "ios",
    reactNative: "0.84.0",
    react: "19.1.0",
    testRenderer: "1.1.0",
    rntl: "14.0.1",
  },
  {
    id: "rn085-light-ios",
    kind: "light",
    platform: "ios",
    reactNative: "0.85.2",
    react: "19.2.0",
    testRenderer: "1.2.0",
    rntl: "14.0.1",
  },
  {
    id: "rn086-light-ios",
    kind: "light",
    platform: "ios",
    reactNative: "0.86.3",
    react: "19.2.3",
    testRenderer: "1.2.0",
    rntl: "14.0.1",
  },
];

export const ALL_ROWS: readonly MatrixRow[] = [...FULL_ROWS, ...LIGHT_ROWS];
