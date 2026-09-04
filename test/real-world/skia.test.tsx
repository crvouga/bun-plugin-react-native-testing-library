import { describe, expect, test } from "bun:test";
import { render } from "@testing-library/react-native";
import { Canvas, Circle, Group, Rect } from "@shopify/react-native-skia";
import * as fc from "fast-check";

describe("react-native-skia", () => {
  test("Canvas with random shapes mounts", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.constantFrom("circle", "rect"), { minLength: 1, maxLength: 6 }),
        async (shapes) => {
          const screen = await render(
            <Canvas style={{ width: 100, height: 100 }} testID="canvas">
              <Group>
                {shapes.map((s, i) =>
                  s === "circle" ? (
                    <Circle key={i} cx={10 + i} cy={10} r={4} color="red" />
                  ) : (
                    <Rect key={i} x={i * 8} y={20} width={6} height={6} color="blue" />
                  ),
                )}
              </Group>
            </Canvas>,
          );
          expect(screen.getByTestId("canvas")).toBeTruthy();
          screen.unmount();
        },
      ),
      { numRuns: 30 },
    );
  });
});
