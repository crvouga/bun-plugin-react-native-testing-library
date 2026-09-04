import { describe, expect, test } from "bun:test";
import { Text, View, Pressable } from "react-native";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import { create } from "zustand";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { configureStore, createSlice } from "@reduxjs/toolkit";
import { Provider, useDispatch, useSelector } from "react-redux";
import { useForm } from "react-hook-form";
import * as fc from "fast-check";

const useBearStore = create<{ bears: number; inc: () => void }>((set) => ({
  bears: 0,
  inc: () => set((s) => ({ bears: s.bears + 1 })),
}));

describe("pure JS libraries", () => {
  test("zustand store updates UI", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 5 }), async (n) => {
        useBearStore.setState({ bears: 0 });
        function Counter() {
          const bears = useBearStore((s) => s.bears);
          const inc = useBearStore((s) => s.inc);
          return (
            <View>
              <Text testID="bears">{bears}</Text>
              <Pressable testID="inc" onPress={inc}>
                <Text>+</Text>
              </Pressable>
            </View>
          );
        }
        const screen = await render(<Counter />);
        for (let i = 0; i < n; i++) await fireEvent.press(screen.getByTestId("inc"));
        expect(screen.getByTestId("bears")).toHaveTextContent(String(n));
        screen.unmount();
      }),
      { numRuns: 20 },
    );
  });

  test("react-query useQuery resolves", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    function Q() {
      const { data, isSuccess } = useQuery({
        queryKey: ["x"],
        queryFn: async () => "ok",
      });
      return <Text testID="q">{isSuccess ? data : "loading"}</Text>;
    }
    const screen = await render(
      <QueryClientProvider client={client}>
        <Q />
      </QueryClientProvider>,
    );
    await waitFor(() => {
      expect(screen.getByTestId("q")).toHaveTextContent("ok");
    });
  });

  test("redux toolkit slice updates", async () => {
    const slice = createSlice({
      name: "counter",
      initialState: { value: 0 },
      reducers: {
        increment: (s) => {
          s.value += 1;
        },
      },
    });
    const store = configureStore({ reducer: { counter: slice.reducer } });
    function C() {
      const v = useSelector((s: { counter: { value: number } }) => s.counter.value);
      const dispatch = useDispatch();
      return (
        <View>
          <Text testID="v">{v}</Text>
          <Pressable testID="inc" onPress={() => dispatch(slice.actions.increment())}>
            <Text>+</Text>
          </Pressable>
        </View>
      );
    }
    const screen = await render(
      <Provider store={store}>
        <C />
      </Provider>,
    );
    await fireEvent.press(screen.getByTestId("inc"));
    expect(screen.getByTestId("v")).toHaveTextContent("1");
  });

  test("react-hook-form submit", async () => {
    function Form() {
      const { register, handleSubmit, setValue, watch } = useForm<{ name: string }>({
        defaultValues: { name: "" },
      });
      const name = watch("name");
      // RN doesn't use register refs the same way — drive via setValue
      void register;
      return (
        <View>
          <Text testID="name">{name}</Text>
          <Pressable testID="set" onPress={() => setValue("name", "ada")}>
            <Text>set</Text>
          </Pressable>
          <Pressable testID="submit" onPress={handleSubmit(() => {})}>
            <Text>go</Text>
          </Pressable>
        </View>
      );
    }
    const screen = await render(<Form />);
    await fireEvent.press(screen.getByTestId("set"));
    expect(screen.getByTestId("name")).toHaveTextContent("ada");
  });
});
