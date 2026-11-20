/** Fixture for jest-compat tests: a real module surface to requireActual/mock. */
export const value = 7;
export function derive(n: number): number {
  return n + value;
}
export default { value, derive };
