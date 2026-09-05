/**
 * Shared deterministic RNTL operation traces for Bun ↔ Jest differential oracle.
 * Keep this file free of test-runner imports so both environments can load it.
 */

export type TraceOp =
  | { op: "render" }
  | { op: "queryByTestId"; id: string; found: boolean }
  | { op: "queryByText"; text: string; found: boolean }
  | { op: "queryByRole"; role: string; found: boolean }
  | { op: "getByLabelText"; label: string; found: boolean }
  | { op: "press"; id: string }
  | { op: "changeText"; id: string; value: string }
  | { op: "rerender"; label: string }
  | { op: "unmount" }
  | { op: "assert"; key: string; value: string | number | boolean | null };

export type TraceResult = {
  ops: TraceOp[];
  presses: number;
  text: string;
  label: string;
};

export const ORACLE_SEQUENCE = [
  "render",
  "query-root",
  "query-button-role",
  "query-label",
  "type",
  "press",
  "press",
  "rerender",
  "query-text",
  "unmount",
] as const;
