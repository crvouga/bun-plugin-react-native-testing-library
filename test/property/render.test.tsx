import { describe, expect, test } from "bun:test";
import * as React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import fc from "fast-check";
import { Counter } from "../example-app/Counter.tsx";
import { Greeting } from "../example-app/Greeting.tsx";
import { TodoList } from "../example-app/TodoList.tsx";

const SEED = Number(process.env.RN_BUN_FC_SEED ?? "0x5a17e0e1");

/** Printable strings safe for RN Text — allow unicode/emoji/RTL, ban C0 controls. */
const rnString = fc
  .string({ minLength: 0, maxLength: 24 })
  .filter((s) => ![...s].some((ch) => {
    const c = ch.codePointAt(0)!;
    return (c < 0x20 && c !== 0x09 && c !== 0x0a) || c === 0x7f;
  }));

describe("property: Greeting rendering via RNTL", () => {
  test("getByText succeeds for non-empty trimmed names; empty-state otherwise", async () => {
    await fc.assert(
      fc.asyncProperty(rnString, async (raw) => {
        const screen = await render(<Greeting name={raw} />);
        const trimmed = raw.trim();
        if (trimmed.length === 0) {
          expect(screen.getByTestId("greeting-empty")).toBeTruthy();
        } else {
          expect(screen.getByText(trimmed, { exact: true })).toBeTruthy();
        }
        await screen.unmount();
      }),
      { numRuns: 100, seed: SEED },
    );
  }, 120_000);
});

describe("property: Counter model-based fireEvent", () => {
  test("press/longPress sequences match the model after every step", async () => {
    const op = fc.constantFrom("press" as const, "longPress" as const);
    await fc.assert(
      fc.asyncProperty(fc.array(op, { minLength: 0, maxLength: 20 }), async (ops) => {
        let model = 0;
        const screen = await render(<Counter initial={0} />);
        const btn = screen.getByTestId("counter-inc");
        for (const o of ops) {
          if (o === "press") {
            await fireEvent.press(btn);
            model += 1;
          } else {
            await fireEvent(btn, "longPress");
            model -= 1;
          }
          expect(screen.getByTestId("counter-value")).toHaveTextContent(String(model));
        }
        await screen.unmount();
      }),
      { numRuns: 100, seed: SEED },
    );
  }, 180_000);
});

describe("property: TodoList model-based add/remove", () => {
  type Op = { type: "add"; text: string } | { type: "remove"; index: number };

  const textArb = fc
    .string({ minLength: 1, maxLength: 12 })
    .filter((s) => s.trim().length > 0 && ![...s].some((ch) => (ch.codePointAt(0) ?? 0) < 0x20));

  test("rendered items and counter always match the model", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.oneof(
            fc.record({ type: fc.constant("add" as const), text: textArb }),
            fc.record({
              type: fc.constant("remove" as const),
              index: fc.nat({ max: 20 }),
            }),
          ),
          { minLength: 0, maxLength: 15 },
        ),
        async (rawOps) => {
          const model: string[] = [];
          const screen = await render(<TodoList />);
          for (const op of rawOps as Op[]) {
            if (op.type === "add") {
              const t = op.text.trim();
              await fireEvent.changeText(screen.getByTestId("todo-input"), t);
              await fireEvent.press(screen.getByTestId("todo-add"));
              model.push(t);
            } else if (model.length > 0) {
              const idx = op.index % model.length;
              await fireEvent.press(screen.getByTestId(`todo-item-${idx}`));
              model.splice(idx, 1);
            }
            expect(screen.getByTestId("todo-count")).toHaveTextContent(String(model.length));
            for (let i = 0; i < model.length; i++) {
              expect(screen.getByTestId(`todo-text-${i}`)).toHaveTextContent(model[i]!);
            }
          }
          await screen.unmount();
        },
      ),
      { numRuns: 100, seed: SEED },
    );
  }, 180_000);
});
