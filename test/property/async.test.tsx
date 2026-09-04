/**
 * Property: waitFor / findBy / waitForElementToBeRemoved with fake timers (deterministic).
 */

import { describe, expect, test, afterEach, jest } from "bun:test";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { cleanup, render, waitFor, waitForElementToBeRemoved } from "@testing-library/react-native";

afterEach(async () => {
  await cleanup();
  jest.useRealTimers();
});

describe("property: async wait utilities", () => {
  test("waitFor resolves after advancing fake timers", async () => {
    jest.useFakeTimers();
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
    const advance = (jest as { advanceTimersByTimeAsync?: (ms: number) => Promise<void> }).advanceTimersByTimeAsync;
    if (advance) await advance(50);
    else jest.advanceTimersByTime(50);
    await waitFor(() => {
      expect(screen.queryByTestId("ready")).toBeTruthy();
    });
    await screen.unmount();
  });

  test("findBy waits for element", async () => {
    jest.useFakeTimers();
    function Delayed() {
      const [ready, setReady] = useState(false);
      useEffect(() => {
        const t = setTimeout(() => setReady(true), 30);
        return () => clearTimeout(t);
      }, []);
      return <View>{ready ? <Text testID="ready">ok</Text> : <Text testID="pending">...</Text>}</View>;
    }
    const screen = await render(<Delayed />);
    const findPromise = screen.findByTestId("ready");
    const advance = (jest as { advanceTimersByTimeAsync?: (ms: number) => Promise<void> }).advanceTimersByTimeAsync;
    if (advance) await advance(40);
    else jest.advanceTimersByTime(40);
    await expect(findPromise).resolves.toBeTruthy();
    await screen.unmount();
  });

  test("waitForElementToBeRemoved", async () => {
    jest.useFakeTimers();
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
    const advance = (jest as { advanceTimersByTimeAsync?: (ms: number) => Promise<void> }).advanceTimersByTimeAsync;
    if (advance) await advance(40);
    else jest.advanceTimersByTime(40);
    await removed;
    expect(screen.queryByTestId("gone-soon")).toBeNull();
    await screen.unmount();
  });
});
