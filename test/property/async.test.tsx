/**
 * Property: waitFor / findBy / waitForElementToBeRemoved with fake timers (deterministic).
 */

import { describe, expect, test, afterEach, jest } from "bun:test";
import { act, useEffect, useState } from "react";
import { Text, View } from "react-native";
import { cleanup, render, waitFor, waitForElementToBeRemoved } from "@testing-library/react-native";

afterEach(async () => {
  await cleanup();
  jest.useRealTimers();
});

async function advanceTimers(ms: number): Promise<void> {
  const advance = (jest as { advanceTimersByTimeAsync?: (n: number) => Promise<void> }).advanceTimersByTimeAsync;
  if (typeof advance === "function") await advance(ms);
  else jest.advanceTimersByTime(ms);
}

describe("property: async wait utilities", () => {
  test("waitFor resolves after advancing fake timers", async () => {
    jest.useFakeTimers();
    try {
      function Delayed({ delay }: { delay: number }) {
        const [ready, setReady] = useState(false);
        useEffect(() => {
          const t = setTimeout(() => setReady(true), delay);
          return () => clearTimeout(t);
        }, [delay]);
        return <View testID="root">{ready ? <Text testID="ready">ok</Text> : <Text testID="pending">...</Text>}</View>;
      }
      const screen = await render(<Delayed delay={40} />);
      expect(screen.getByTestId("pending")).toBeTruthy();

      // Advance under act so the setState from the timeout is committed before waitFor.
      await act(async () => {
        await advanceTimers(50);
      });
      await waitFor(() => {
        expect(screen.queryByTestId("ready")).toBeTruthy();
      });
      await screen.unmount();
    } finally {
      jest.useRealTimers();
    }
  });

  test("findBy waits for element", async () => {
    jest.useFakeTimers();
    try {
      function Delayed() {
        const [ready, setReady] = useState(false);
        useEffect(() => {
          const t = setTimeout(() => setReady(true), 30);
          return () => clearTimeout(t);
        }, []);
        return <View>{ready ? <Text testID="ready">ok</Text> : <Text testID="pending">...</Text>}</View>;
      }
      const screen = await render(<Delayed />);
      expect(screen.getByTestId("pending")).toBeTruthy();

      // Kick findBy first (it polls under its own act), then advance timers without nesting act.
      const found = screen.findByTestId("ready");
      await advanceTimers(40);
      await expect(found).resolves.toBeTruthy();
      await screen.unmount();
    } finally {
      jest.useRealTimers();
    }
  });

  test("waitForElementToBeRemoved", async () => {
    jest.useFakeTimers();
    try {
      function FadeOut() {
        const [show, setShow] = useState(true);
        useEffect(() => {
          const t = setTimeout(() => setShow(false), 25);
          return () => clearTimeout(t);
        }, []);
        return <View testID="root">{show ? <Text testID="gone-soon">x</Text> : null}</View>;
      }
      const screen = await render(<FadeOut />);
      expect(screen.getByTestId("gone-soon")).toBeTruthy();

      const removed = waitForElementToBeRemoved(() => screen.getByTestId("gone-soon"));
      await advanceTimers(40);
      await removed;
      expect(screen.queryByTestId("gone-soon")).toBeNull();
      await screen.unmount();
    } finally {
      jest.useRealTimers();
    }
  });
});
