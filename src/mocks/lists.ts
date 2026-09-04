/**
 * List mocks: VirtualizedList, FlatList, SectionList, VirtualizedSectionList.
 */

import type * as ReactNS from "react";

function renderMaybe(
  React: typeof ReactNS,
  c: ReactNS.ReactNode | ReactNS.ComponentType | undefined,
): ReactNS.ReactNode {
  if (c == null) return null;
  if (typeof c === "function") return React.createElement(c as ReactNS.ComponentType);
  return c as ReactNS.ReactNode;
}

export type FlatListProps = {
  data?: ReadonlyArray<unknown>;
  renderItem?: (info: { item: unknown; index: number }) => ReactNS.ReactNode;
  keyExtractor?: (item: unknown, index: number) => string;
  ListHeaderComponent?: ReactNS.ReactNode | ReactNS.ComponentType;
  ListFooterComponent?: ReactNS.ReactNode | ReactNS.ComponentType;
  ListEmptyComponent?: ReactNS.ReactNode | ReactNS.ComponentType;
  ItemSeparatorComponent?: ReactNS.ComponentType;
  testID?: string;
  [key: string]: unknown;
};

export type Section = {
  data: ReadonlyArray<unknown>;
  key?: string;
  title?: string;
  [key: string]: unknown;
};

export type SectionListProps = {
  sections?: ReadonlyArray<Section>;
  renderItem?: (info: { item: unknown; index: number; section: Section }) => ReactNS.ReactNode;
  renderSectionHeader?: (info: { section: Section }) => ReactNS.ReactNode;
  renderSectionFooter?: (info: { section: Section }) => ReactNS.ReactNode;
  keyExtractor?: (item: unknown, index: number) => string;
  ListHeaderComponent?: ReactNS.ReactNode | ReactNS.ComponentType;
  ListFooterComponent?: ReactNS.ReactNode | ReactNS.ComponentType;
  ListEmptyComponent?: ReactNS.ReactNode | ReactNS.ComponentType;
  ItemSeparatorComponent?: ReactNS.ComponentType;
  SectionSeparatorComponent?: ReactNS.ComponentType;
  testID?: string;
  [key: string]: unknown;
};

export function createLists(React: typeof ReactNS, View: ReactNS.ComponentType) {
  const VirtualizedList = class VirtualizedList extends React.Component<FlatListProps> {
    static displayName = "VirtualizedList";
    scrollToIndex = () => {};
    scrollToOffset = () => {};
    scrollToEnd = () => {};
    recordInteraction = () => {};
    flashScrollIndicators = () => {};
    getScrollResponder = () => null;
    getScrollableNode = () => null;
    render() {
      const {
        data = [],
        renderItem,
        keyExtractor,
        ListHeaderComponent,
        ListFooterComponent,
        ListEmptyComponent,
        ItemSeparatorComponent,
        ...rest
      } = this.props;

      const items =
        data.length === 0
          ? [renderMaybe(React, ListEmptyComponent)]
          : data.flatMap((item, index) => {
              const row = renderItem?.({ item, index }) ?? null;
              const key = keyExtractor ? keyExtractor(item, index) : String(index);
              const nodes: ReactNS.ReactNode[] = [React.createElement(React.Fragment, { key }, row)];
              if (ItemSeparatorComponent && index < data.length - 1) {
                nodes.push(React.createElement(ItemSeparatorComponent, { key: `sep-${key}` }));
              }
              return nodes;
            });

      return React.createElement(
        "RCTScrollView",
        rest,
        renderMaybe(React, ListHeaderComponent),
        React.createElement(View, null, ...items),
        renderMaybe(React, ListFooterComponent),
      );
    }
  };

  const FlatList = class FlatList extends VirtualizedList {
    static displayName = "FlatList";
  };

  const SectionList = class SectionList extends React.Component<SectionListProps> {
    static displayName = "SectionList";
    scrollToLocation = () => {};
    recordInteraction = () => {};
    flashScrollIndicators = () => {};
    getScrollResponder = () => null;
    getScrollableNode = () => null;
    render() {
      const {
        sections = [],
        renderItem,
        renderSectionHeader,
        renderSectionFooter,
        keyExtractor,
        ListHeaderComponent,
        ListFooterComponent,
        ListEmptyComponent,
        ItemSeparatorComponent,
        SectionSeparatorComponent,
        ...rest
      } = this.props;

      const totalItems = sections.reduce((n, s) => n + (s.data?.length ?? 0), 0);
      if (totalItems === 0 && sections.length === 0) {
        return React.createElement(
          "RCTScrollView",
          rest,
          renderMaybe(React, ListHeaderComponent),
          renderMaybe(React, ListEmptyComponent),
          renderMaybe(React, ListFooterComponent),
        );
      }

      const nodes: ReactNS.ReactNode[] = [];
      sections.forEach((section, sIdx) => {
        if (renderSectionHeader) {
          nodes.push(
            React.createElement(React.Fragment, { key: `sh-${section.key ?? sIdx}` }, renderSectionHeader({ section })),
          );
        }
        const data = section.data ?? [];
        data.forEach((item, index) => {
          const key = keyExtractor ? keyExtractor(item, index) : `${section.key ?? sIdx}-${index}`;
          nodes.push(React.createElement(React.Fragment, { key }, renderItem?.({ item, index, section }) ?? null));
          if (ItemSeparatorComponent && index < data.length - 1) {
            nodes.push(React.createElement(ItemSeparatorComponent, { key: `sep-${key}` }));
          }
        });
        if (renderSectionFooter) {
          nodes.push(
            React.createElement(React.Fragment, { key: `sf-${section.key ?? sIdx}` }, renderSectionFooter({ section })),
          );
        }
        if (SectionSeparatorComponent && sIdx < sections.length - 1) {
          nodes.push(
            React.createElement(SectionSeparatorComponent, {
              key: `ssep-${sIdx}`,
            }),
          );
        }
      });

      return React.createElement(
        "RCTScrollView",
        rest,
        renderMaybe(React, ListHeaderComponent),
        React.createElement(View, null, ...nodes),
        renderMaybe(React, ListFooterComponent),
      );
    }
  };

  const VirtualizedSectionList = SectionList;

  return { VirtualizedList, FlatList, SectionList, VirtualizedSectionList };
}

export const DEFAULT_INITIAL_NUM_TO_RENDER = 10;
