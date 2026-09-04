import { describe, expect, test } from "bun:test";
import { render } from "@testing-library/react-native";
import Svg, { Circle, Rect, Path } from "react-native-svg";
import * as fc from "fast-check";

describe("react-native-svg", () => {
  test("Svg trees render with testIDs", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.constantFrom("circle", "rect", "path"), { minLength: 1, maxLength: 5 }),
        async (shapes) => {
          const screen = await render(
            <Svg testID="svg" width={100} height={100}>
              {shapes.map((s, i) => {
                if (s === "circle") {
                  return <Circle key={i} testID={`c-${i}`} cx={10} cy={10} r={5} fill="red" />;
                }
                if (s === "rect") {
                  return <Rect key={i} testID={`r-${i}`} x={0} y={0} width={20} height={10} fill="blue" />;
                }
                return <Path key={i} testID={`p-${i}`} d="M0 0 L10 10" stroke="black" />;
              })}
            </Svg>,
          );
          expect(screen.getByTestId("svg")).toBeTruthy();
          shapes.forEach((s, i) => {
            const id = s === "circle" ? `c-${i}` : s === "rect" ? `r-${i}` : `p-${i}`;
            expect(screen.getByTestId(id)).toBeTruthy();
          });
          screen.unmount();
        },
      ),
      { numRuns: 40 },
    );
  });
});
