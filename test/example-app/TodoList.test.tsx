import { describe, expect, test } from "bun:test";
import * as React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { TodoList } from "./TodoList.tsx";

describe("TodoList", () => {
  test("adds and removes items", async () => {
    const screen = await render(<TodoList />);
    expect(screen.getByTestId("todo-count")).toHaveTextContent("0");

    await fireEvent.changeText(screen.getByTestId("todo-input"), "milk");
    await fireEvent.press(screen.getByTestId("todo-add"));
    expect(screen.getByTestId("todo-count")).toHaveTextContent("1");
    expect(screen.getByTestId("todo-text-0")).toHaveTextContent("milk");

    await fireEvent.press(screen.getByTestId("todo-item-0"));
    expect(screen.getByTestId("todo-count")).toHaveTextContent("0");
  });
});
