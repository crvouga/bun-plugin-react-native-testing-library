import { describe, expect, test } from "bun:test";
import * as React from "react";
import { render } from "@testing-library/react-native";
import { Greeting } from "./Greeting.tsx";

describe("Greeting", () => {
  test("renders the name", async () => {
    const screen = await render(<Greeting name="Ada" />);
    expect(screen.getByText("Ada", { exact: true })).toBeOnTheScreen();
    expect(screen.getByTestId("greeting-text")).toHaveTextContent("Ada");
  });

  test("shows empty state for blank name", async () => {
    const screen = await render(<Greeting name="   " />);
    expect(screen.getByTestId("greeting-empty")).toBeOnTheScreen();
  });
});
