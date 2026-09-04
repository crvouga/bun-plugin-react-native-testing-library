/**
 * Property: FlatList / SectionList rendering vs model.
 */

import { describe, expect, test } from "bun:test";
import { FlatList, SectionList, Text, View } from "react-native";
import { render } from "@testing-library/react-native";
import * as fc from "fast-check";
import { fcOpts } from "../fc-opts.ts";

describe("property: lists", () => {
  test("FlatList row/separator/header/footer counts", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.stringMatching(/^[A-Za-z]{1,6}$/), { minLength: 0, maxLength: 8 }),
        fc.boolean(),
        fc.boolean(),
        async (data, withHeader, withFooter) => {
          const Separator = () => <View testID="sep" />;
          const Header = () => <Text testID="hdr">H</Text>;
          const Footer = () => <Text testID="ftr">F</Text>;
          const Empty = () => <Text testID="empty">none</Text>;

          const screen = await render(
            <FlatList
              testID="list"
              data={data}
              keyExtractor={(item, i) => `${i}-${item}`}
              renderItem={({ item, index }) => <Text testID={`row-${index}`}>{item}</Text>}
              ItemSeparatorComponent={Separator}
              ListHeaderComponent={withHeader ? Header : undefined}
              ListFooterComponent={withFooter ? Footer : undefined}
              ListEmptyComponent={Empty}
            />,
          );

          if (data.length === 0) {
            expect(screen.queryByTestId("empty")).toBeTruthy();
          } else {
            for (let i = 0; i < data.length; i++) {
              expect(screen.queryByTestId(`row-${i}`)).toBeTruthy();
            }
            if (data.length > 1) {
              expect(screen.getAllByTestId("sep").length).toBe(data.length - 1);
            }
          }
          if (withHeader) expect(screen.queryByTestId("hdr")).toBeTruthy();
          if (withFooter) expect(screen.queryByTestId("ftr")).toBeTruthy();
          screen.unmount();
        },
      ),
      fcOpts,
    );
  });

  test("SectionList section headers and items", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            title: fc.stringMatching(/^[A-Z]{1,4}$/),
            data: fc.array(fc.stringMatching(/^[a-z]{1,4}$/), {
              minLength: 0,
              maxLength: 4,
            }),
          }),
          { minLength: 1, maxLength: 4 },
        ),
        async (sections) => {
          const keyed = sections.map((s, i) => ({ ...s, key: `s${i}` }));
          const screen = await render(
            <SectionList
              testID="slist"
              sections={keyed}
              keyExtractor={(item, i) => `${i}-${item}`}
              renderItem={({ item, index, section }) => <Text testID={`item-${section.key}-${index}`}>{item}</Text>}
              renderSectionHeader={({ section }) => <Text testID={`hdr-${section.key}`}>{section.title}</Text>}
            />,
          );

          for (const s of keyed) {
            expect(screen.queryByTestId(`hdr-${s.key}`)).toBeTruthy();
            s.data.forEach((_, i) => {
              expect(screen.queryByTestId(`item-${s.key}-${i}`)).toBeTruthy();
            });
          }
          screen.unmount();
        },
      ),
      fcOpts,
    );
  });
});
