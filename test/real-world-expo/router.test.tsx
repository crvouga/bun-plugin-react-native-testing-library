/**
 * expo-router/testing-library renderRouter with in-memory routes.
 */

import { describe, expect, test } from "bun:test";
import { Text, View } from "react-native";
import * as fc from "fast-check";

const opts = { numRuns: 6, endOnFailure: true as const };

describe("expo-router renderRouter", () => {
  test("in-memory routes expose pathname helpers", async () => {
    let renderRouter: typeof import("expo-router/testing-library").renderRouter;
    try {
      ({ renderRouter } = await import("expo-router/testing-library"));
    } catch (err) {
      throw new Error(
        `expo-router/testing-library failed to import under Bun: ${err instanceof Error ? err.message : err}`,
      );
    }

    await fc.assert(
      fc.asyncProperty(fc.constantFrom("/", "/detail"), async (initialUrl) => {
        let screen: Awaited<ReturnType<typeof renderRouter>>;
        try {
          screen = await renderRouter(
            {
              index: () => (
                <View testID="home">
                  <Text>Home</Text>
                </View>
              ),
              detail: () => (
                <View testID="detail">
                  <Text>Detail</Text>
                </View>
              ),
            },
            { initialUrl },
          );
        } catch (err) {
          throw new Error(
            `UNSUPPORTED: expo-router ExpoRoot failed under Bun — ${err instanceof Error ? err.message : err}`,
          );
        }

        expect(typeof screen.getPathname).toBe("function");
        expect(typeof screen.getSegments).toBe("function");
        if (initialUrl === "/") {
          expect(screen.getByTestId("home")).toBeOnTheScreen();
          expect(screen.getPathname()).toBe("/");
        } else {
          expect(screen.getByTestId("detail")).toBeOnTheScreen();
          expect(screen.getPathname()).toBe("/detail");
        }
        screen.unmount();
      }),
      opts,
    );
  }, 120_000);
});
