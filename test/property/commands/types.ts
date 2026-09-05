/**
 * Shared command types for root property walks.
 */

import type { ReactTestInstance } from "react-test-renderer";

export type ScreenHandle = {
  getByTestId: (id: string) => ReactTestInstance;
  queryByTestId: (id: string) => ReactTestInstance | null;
  getByText: (text: string | RegExp) => ReactTestInstance;
  queryByText: (text: string | RegExp) => ReactTestInstance | null;
  rerender: (ui: React.ReactElement) => Promise<unknown> | unknown;
  unmount: () => Promise<unknown> | unknown;
};

export type MonkeyModel = {
  text: string;
  on: boolean;
  items: string[];
  presses: number;
  disabled: boolean;
  mounted: boolean;
};
