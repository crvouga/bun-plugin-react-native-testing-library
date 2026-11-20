/** Fixture for jest-compat tests: stateful module for isolation semantics. */
export let count = 0;
export function increment(): number {
  count += 1;
  return count;
}
