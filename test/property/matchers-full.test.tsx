/**
 * Property: all RNTL matchers vs model predicates (+ .not inverse).
 */

import { describe, expect, test } from "bun:test";
import { Pressable, Switch, Text, TextInput, View } from "react-native";
import { render } from "@testing-library/react-native";
import * as fc from "fast-check";
import { fcRuns } from "../fc-opts.ts";
import { RNTL_MATCHER_NAMES } from "../../src/rntl.ts";

describe("property: RNTL matchers", () => {
  test("RNTL_MATCHER_NAMES matches shipped matchers", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const shipped = Object.keys(require("@testing-library/react-native/matchers")).sort();
    expect([...RNTL_MATCHER_NAMES].sort()).toEqual(shipped);
  });

  test("on-screen / text / style / prop / a11y matchers track model", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          text: fc.stringMatching(/^[A-Za-z][A-Za-z0-9 ]{0,10}$/),
          disabled: fc.boolean(),
          checked: fc.boolean(),
          selected: fc.boolean(),
          busy: fc.boolean(),
          expanded: fc.boolean(),
          width: fc.integer({ min: 10, max: 200 }),
          input: fc.stringMatching(/^[A-Za-z0-9]{0,8}$/),
        }),
        async (m) => {
          const screen = await render(
            <View testID="root" style={{ width: m.width, opacity: 1 }}>
              <Text testID="label" accessibilityLabel={m.text}>
                {m.text}
              </Text>
              <Pressable
                testID="btn"
                accessibilityRole="button"
                accessibilityLabel={m.text}
                accessibilityState={{
                  disabled: m.disabled,
                  selected: m.selected,
                  busy: m.busy,
                  expanded: m.expanded,
                }}
                disabled={m.disabled}
                accessible
                onPress={() => {}}
              >
                <Text>Go</Text>
              </Pressable>
              <Switch
                testID="sw"
                value={m.checked}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: m.checked ? true : false }}
                onValueChange={() => {}}
              />
              <TextInput testID="input" value={m.input} onChangeText={() => {}} />
              <View testID="empty" />
              <View testID="parent">
                <Text testID="child">c</Text>
              </View>
            </View>,
          );

          const root = screen.getByTestId("root");
          const label = screen.getByTestId("label");
          const btn = screen.getByTestId("btn");
          const sw = screen.getByTestId("sw");
          const input = screen.getByTestId("input");
          const empty = screen.getByTestId("empty");
          const parent = screen.getByTestId("parent");
          const child = screen.getByTestId("child");

          expect(root).toBeOnTheScreen();
          expect(label).toBeVisible();
          expect(label).toHaveTextContent(m.text);
          expect(label).toHaveAccessibleName(m.text);
          expect(root).toHaveStyle({ width: m.width });
          expect(root).toHaveProp("testID", "root");

          if (m.disabled) {
            expect(btn).toBeDisabled();
            expect(btn).not.toBeEnabled();
          } else {
            expect(btn).toBeEnabled();
            expect(btn).not.toBeDisabled();
          }

          if (m.busy) expect(btn).toBeBusy();
          else expect(btn).not.toBeBusy();

          if (m.selected) expect(btn).toBeSelected();
          else expect(btn).not.toBeSelected();

          if (m.expanded) {
            expect(btn).toBeExpanded();
            expect(btn).not.toBeCollapsed();
          } else {
            expect(btn).toBeCollapsed();
            expect(btn).not.toBeExpanded();
          }

          if (m.checked) {
            expect(sw).toBeChecked();
            expect(sw).not.toBePartiallyChecked();
          } else {
            expect(sw).not.toBeChecked();
          }

          expect(input).toHaveDisplayValue(m.input);
          expect(empty).toBeEmptyElement();
          expect(parent).toContainElement(child);
          expect(parent).not.toContainElement(btn);

          expect(btn).toHaveAccessibilityValue({});

          screen.unmount();
        },
      ),
      fcRuns(20),
    );
  }, 60_000);
});
