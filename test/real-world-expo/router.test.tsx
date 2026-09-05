/**
 * expo-router/testing-library renderRouter with in-memory routes + navigation model.
 *
 * Import at module scope — RNTL's entry registers beforeAll/afterAll on load.
 *
 * Note: expo-router's renderRouter Object.assigns helpers onto the Promise returned
 * by async RNTL `render()`, so pathname helpers live on the promise object, not the
 * awaited screen.
 */

import { describe, expect, test } from "bun:test";
import { Text, View } from "react-native";
import * as fc from "fast-check";
import { act } from "@testing-library/react-native";
import { renderRouter } from "expo-router/testing-library";
// Prefer imperative-api entry — importing `expo-router` pulls Expo.fx + deep screens paths.
import { router } from "expo-router/build/imperative-api";

const opts = { numRuns: 8, endOnFailure: true as const };

type RouterHelpers = {
  getPathname: () => string;
  getSegments: () => string[];
  getSearchParams: () => Record<string, unknown>;
};

const routes = {
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
  "items/[id]": () => (
    <View testID="item">
      <Text>Item</Text>
    </View>
  ),
  "+not-found": () => (
    <View testID="not-found">
      <Text>Missing</Text>
    </View>
  ),
};

describe("expo-router renderRouter", () => {
  test("initialUrl matches pathname model", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom("/", "/detail", "/items/42"), async (initialUrl) => {
        const pending = renderRouter(routes, { initialUrl }) as unknown as Promise<unknown> & RouterHelpers;
        const screen = (await pending) as Awaited<ReturnType<typeof renderRouter>>;
        expect(typeof pending.getPathname).toBe("function");
        expect(pending.getPathname()).toBe(initialUrl);
        if (initialUrl === "/") expect(screen.getByTestId("home")).toBeOnTheScreen();
        if (initialUrl === "/detail") expect(screen.getByTestId("detail")).toBeOnTheScreen();
        if (initialUrl === "/items/42") expect(screen.getByTestId("item")).toBeOnTheScreen();
        await screen.unmount();
      }),
      opts,
    );
  }, 120_000);

  test("push / replace / back vs stack model", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.constantFrom("push-detail", "push-item", "replace-home", "back") as fc.Arbitrary<string>, {
          minLength: 1,
          maxLength: 6,
        }),
        async (ops) => {
          const pending = renderRouter(routes, { initialUrl: "/" }) as unknown as Promise<unknown> & RouterHelpers;
          const screen = (await pending) as Awaited<ReturnType<typeof renderRouter>>;
          const stack = ["/"];
          for (const op of ops) {
            if (op === "push-detail") {
              await act(() => {
                router.push("/detail");
              });
              stack.push("/detail");
            } else if (op === "push-item") {
              await act(() => {
                router.push("/items/7");
              });
              stack.push("/items/7");
            } else if (op === "replace-home") {
              await act(() => {
                router.replace("/");
              });
              stack[stack.length - 1] = "/";
            } else if (op === "back" && stack.length > 1) {
              await act(() => {
                router.back();
              });
              stack.pop();
            }
            expect(pending.getPathname()).toBe(stack[stack.length - 1]!);
          }
          await screen.unmount();
        },
      ),
      { numRuns: 5, endOnFailure: true },
    );
  }, 120_000);
});
