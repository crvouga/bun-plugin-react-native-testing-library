import { describe, expect, test } from "bun:test";
import { fireEvent, render } from "@testing-library/react-native";
import { Counter } from "./Counter.tsx";

describe("Counter", () => {
  test("increments on press and decrements on long press", async () => {
    const screen = await render(<Counter initial={0} />);
    expect(screen.getByTestId("counter-value")).toHaveTextContent("0");

    await fireEvent.press(screen.getByTestId("counter-inc"));
    expect(screen.getByTestId("counter-value")).toHaveTextContent("1");

    await fireEvent(screen.getByTestId("counter-inc"), "longPress");
    expect(screen.getByTestId("counter-value")).toHaveTextContent("0");
  });
});
