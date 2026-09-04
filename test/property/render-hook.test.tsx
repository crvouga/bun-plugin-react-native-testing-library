/**
 * Property: renderHook vs reducer model.
 */

import { describe, expect, test } from "bun:test";
import { act, useReducer } from "react";
import { renderHook } from "@testing-library/react-native";
import * as fc from "fast-check";
import { fcRuns } from "../fc-opts.ts";

describe("property: renderHook", () => {
  test("tracks reducer model", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.constantFrom("inc", "dec", "reset") as fc.Arbitrary<"inc" | "dec" | "reset">, {
          minLength: 1,
          maxLength: 12,
        }),
        async (ops) => {
          function reducer(state: number, action: "inc" | "dec" | "reset") {
            if (action === "inc") return state + 1;
            if (action === "dec") return state - 1;
            return 0;
          }
          const { result, rerender, unmount } = await renderHook(() => useReducer(reducer, 0));
          expect(result.current).not.toBeNull();
          let model = 0;
          for (const op of ops) {
            const dispatch = result.current![1];
            await act(() => {
              dispatch(op);
            });
            model = reducer(model, op);
            expect(result.current![0]).toBe(model);
          }
          await rerender();
          await unmount();
        },
      ),
      fcRuns(15),
    );
  }, 30_000);
});
