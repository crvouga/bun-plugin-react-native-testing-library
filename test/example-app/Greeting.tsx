import * as React from "react";
import { Text, View } from "react-native";

export type GreetingProps = {
  name: string;
};

export function Greeting({ name }: GreetingProps) {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return (
      <View testID="greeting-empty" accessibilityLabel="empty greeting">
        <Text>Hello, stranger</Text>
      </View>
    );
  }
  return (
    <View testID="greeting-root">
      <Text testID="greeting-text">{trimmed}</Text>
    </View>
  );
}
