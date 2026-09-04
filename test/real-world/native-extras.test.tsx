import { describe, expect, test } from "bun:test";
import { render } from "@testing-library/react-native";
import { WebView } from "react-native-webview";
import LinearGradient from "react-native-linear-gradient";
import DeviceInfo from "react-native-device-info";
import * as fc from "fast-check";

describe("webview / linear-gradient / device-info", () => {
  test("WebView mounts with uri", async () => {
    await fc.assert(
      fc.asyncProperty(fc.webUrl(), async (uri) => {
        const screen = await render(<WebView testID="wv" source={{ uri }} />);
        expect(screen.getByTestId("wv")).toBeTruthy();
        screen.unmount();
      }),
      { numRuns: 20 },
    );
  });

  test("LinearGradient mounts with colors", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.constantFrom("#f00", "#0f0", "#00f", "#fff"), { minLength: 2, maxLength: 4 }),
        async (colors) => {
          const screen = await render(<LinearGradient testID="grad" colors={colors} style={{ flex: 1 }} />);
          expect(screen.getByTestId("grad")).toBeTruthy();
          screen.unmount();
        },
      ),
      { numRuns: 20 },
    );
  });

  test("DeviceInfo getters resolve", async () => {
    const brand = await DeviceInfo.getBrand();
    const model = await DeviceInfo.getModel();
    expect(typeof brand).toBe("string");
    expect(typeof model).toBe("string");
  });
});
