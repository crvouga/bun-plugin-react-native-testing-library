/**
 * Property: fake timers + waitFor (single deterministic case — fail-fast).
 */

import { describe, expect, test, jest } from "bun:test";
import { act, useEffect, useState } from "react";
import { Text, View } from "react-native";
import { render, waitFor } from "@testing-library/react-native";

describe("property: fake timers", () => {
  test("waitFor resolves after advancing fake timers", async () => {
    const delay = 50;
    jest.useFakeTimers();
    try {
      function Delayed() {
        const [ready, setReady] = useState(false);
        useEffect(() => {
          const t = setTimeout(() => setReady(true), delay);
          return () => clearTimeout(t);
        }, []);
        return <View testID="root">{ready ? <Text testID="ready">ok</Text> : <Text testID="pending">...</Text>}</View>;
      }

      const screen = await render(<Delayed />);
      expect(screen.queryByTestId("pending")).toBeTruthy();

      await act(async () => {
        const asyncAdvance = (jest as any).advanceTimersByTimeAsync as ((ms: number) => Promise<void>) | undefined;
        if (typeof asyncAdvance === "function") {
          await asyncAdvance(delay + 5);
        } else {
          jest.advanceTimersByTime(delay + 5);
        }
      });

      await waitFor(() => {
        expect(screen.queryByTestId("ready")).toBeTruthy();
      });
      screen.unmount();
    } finally {
      jest.useRealTimers();
    }
  });
});
