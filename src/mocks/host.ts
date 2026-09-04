/**
 * Host-component mock factory.
 *
 * Inspired by `@react-native/jest-preset`'s `mockComponent` (MIT, Meta),
 * but without `jest.requireActual` — we never load the real RN source for
 * host components. RNTL identifies hosts by string `type` (`"View"`, `"Text"`, …).
 *
 * Always pass the consumer's React (resolved from `process.cwd()`) so hooks
 * and reconcilers share a single React copy.
 */

import type * as ReactNS from "react";

export type HostComponentProps = Record<string, unknown> & {
  children?: ReactNS.ReactNode;
};

/**
 * Create a React class component that renders a host element of `hostName`.
 */
export function createHostComponent(
  React: typeof ReactNS,
  hostName: string,
  options: {
    statics?: Record<string, unknown>;
    instanceMethods?: Record<string, unknown>;
  } = {},
): ReactNS.ComponentClass<HostComponentProps> {
  class Host extends React.Component<HostComponentProps> {
    static displayName = hostName;
    render() {
      const { children, ...rest } = this.props;
      return React.createElement(hostName, rest, children);
    }
  }
  Object.defineProperty(Host, "name", { value: hostName, configurable: true });
  if (options.statics) {
    Object.assign(Host, options.statics);
  }
  if (options.instanceMethods) {
    Object.assign(Host.prototype, options.instanceMethods);
  }
  return Host;
}

/** No-op function suitable as a mock method. */
export const noop = (..._args: unknown[]): void => {};

/** Async no-op that resolves. */
export const asyncNoop = async (..._args: unknown[]): Promise<void> => {};
