/**
 * Dimensions / useWindowDimensions mocks.
 */

import type { WindowMetrics } from "../config.ts";

export type DimensionsPayload = {
  window: WindowMetrics;
  screen: WindowMetrics;
};

type Listener = (payload: DimensionsPayload) => void;

export function createDimensions(window: WindowMetrics) {
  let current: DimensionsPayload = {
    window: { ...window },
    screen: { ...window },
  };
  const listeners = new Set<Listener>();

  const Dimensions = {
    get(dim: "window" | "screen"): WindowMetrics {
      return current[dim];
    },
    set(dims: Partial<DimensionsPayload>): void {
      current = {
        window: dims.window ? { ...dims.window } : current.window,
        screen: dims.screen ? { ...dims.screen } : current.screen,
      };
      for (const l of listeners) l(current);
    },
    addEventListener(_type: "change", handler: Listener): { remove: () => void } {
      listeners.add(handler);
      return {
        remove() {
          listeners.delete(handler);
        },
      };
    },
  };

  return Dimensions;
}

export function createUseWindowDimensions(React: typeof import("react"), window: WindowMetrics) {
  return function useWindowDimensions(): WindowMetrics {
    const [dims] = React.useState(window);
    return dims;
  };
}
