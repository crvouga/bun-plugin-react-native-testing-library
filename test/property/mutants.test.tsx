/**
 * Property: healthy mutants pass; every fault makes the oracle assert fail.
 */

import { describe, expect, test, jest } from "bun:test";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import * as fc from "fast-check";
import { fcRuns } from "../fc-opts.ts";
import { MutantAsync, MutantCounter, MutantDisabledButton, MutantTodo, type Fault } from "../example-app/mutants.tsx";

describe("property: mutant twins", () => {
  test("healthy counter increments", async () => {
    const screen = await render(<MutantCounter bug="none" />);
    await fireEvent.press(screen.getByTestId("inc"));
    await waitFor(() => {
      expect(screen.getByTestId("count")).toHaveTextContent("1");
    });
    screen.unmount();
  });

  test("healthy todo adds item", async () => {
    const screen = await render(<MutantTodo bug="none" />);
    await fireEvent.changeText(screen.getByTestId("input"), "alpha");
    await fireEvent.press(screen.getByTestId("add"));
    await waitFor(() => {
      expect(screen.getByTestId("total")).toHaveTextContent("1");
      expect(screen.getByText("alpha")).toBeTruthy();
    });
    screen.unmount();
  });

  test("healthy disabled button is disabled", async () => {
    const screen = await render(<MutantDisabledButton bug="none" disabled />);
    expect(screen.getByTestId("btn")).toBeDisabled();
    expect(screen.getByTestId("n")).toHaveTextContent("0");
    screen.unmount();
  });

  test("healthy async resolves", async () => {
    jest.useRealTimers();
    const screen = await render(<MutantAsync bug="none" />);
    await waitFor(() => {
      expect(screen.queryByTestId("ready")).toBeTruthy();
    });
    screen.unmount();
  });

  test("each fault makes at least one oracle fail", async () => {
    const faults = fc.constantFrom(
      "off-by-one",
      "ignore-disabled",
      "drop-last-item",
      "wrong-testid",
      "never-resolves",
      "swallow-press",
    ) as fc.Arbitrary<Fault>;

    await fc.assert(
      fc.asyncProperty(faults, async (bug) => {
        let failed = false;
        try {
          if (bug === "off-by-one" || bug === "swallow-press") {
            const screen = await render(<MutantCounter bug={bug} />);
            await fireEvent.press(screen.getByTestId("inc"));
            await waitFor(
              () => {
                expect(screen.getByTestId("count")).toHaveTextContent("1");
              },
              { timeout: 100 },
            );
            screen.unmount();
          } else if (bug === "wrong-testid") {
            const screen = await render(<MutantCounter bug={bug} />);
            expect(screen.getByTestId("counter")).toBeOnTheScreen();
            screen.unmount();
          } else if (bug === "drop-last-item") {
            const screen = await render(<MutantTodo bug={bug} />);
            await fireEvent.changeText(screen.getByTestId("input"), "alpha");
            await fireEvent.press(screen.getByTestId("add"));
            await waitFor(
              () => {
                expect(screen.getByTestId("total")).toHaveTextContent("1");
              },
              { timeout: 100 },
            );
            screen.unmount();
          } else if (bug === "ignore-disabled") {
            const screen = await render(<MutantDisabledButton bug={bug} disabled />);
            expect(screen.getByTestId("btn")).toBeDisabled();
            screen.unmount();
          } else if (bug === "never-resolves") {
            jest.useRealTimers();
            const screen = await render(<MutantAsync bug={bug} />);
            await waitFor(
              () => {
                expect(screen.queryByTestId("ready")).toBeTruthy();
              },
              { timeout: 80 },
            );
            screen.unmount();
          }
        } catch {
          failed = true;
        }
        expect(failed).toBe(true);
      }),
      fcRuns(12),
    );
  }, 90_000);
});
