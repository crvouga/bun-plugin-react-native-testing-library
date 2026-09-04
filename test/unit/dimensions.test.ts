import { describe, expect, test } from "bun:test";
import { createDimensions } from "../../src/mocks/Dimensions.ts";
import { DEFAULT_WINDOW } from "../../src/config.ts";

describe("Dimensions mock", () => {
  test("get/set/addEventListener", () => {
    const dims = createDimensions(DEFAULT_WINDOW);
    expect(dims.get("window").width).toBe(390);
    let seen = false;
    const sub = dims.addEventListener("change", () => {
      seen = true;
    });
    dims.set({ window: { ...DEFAULT_WINDOW, width: 100 } });
    expect(dims.get("window").width).toBe(100);
    expect(seen).toBe(true);
    sub.remove();
  });
});
