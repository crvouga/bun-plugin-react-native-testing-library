import { describe, expect, test } from "bun:test";
import { render } from "@testing-library/react-native";
import { ThemedBox } from "./ThemedBox.tsx";

describe("ThemedBox", () => {
  test("renders platform label and dimensions", async () => {
    const screen = await render(<ThemedBox />);
    expect(screen.getByTestId("themed-box")).toBeOnTheScreen();
    expect(screen.getByTestId("themed-box")).toBeVisible();
    expect(screen.getByTestId("themed-label")).toHaveTextContent("ios-box");
    expect(screen.getByTestId("themed-size")).toHaveTextContent("390x844");
  });

  test("snapshot", async () => {
    const screen = await render(<ThemedBox />);
    expect(screen.toJSON()).toMatchSnapshot();
  });
});
