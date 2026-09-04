import { useState } from "react";
import { Pressable, Text, View } from "react-native";

export type CounterProps = {
  initial?: number;
};

export function Counter({ initial = 0 }: CounterProps) {
  const [count, setCount] = useState(initial);

  return (
    <View testID="counter-root" accessibilityLabel="counter">
      <Text testID="counter-value" accessibilityLabel={`count is ${count}`}>
        {count}
      </Text>
      <Pressable
        testID="counter-inc"
        accessibilityRole="button"
        accessibilityLabel="increment"
        onPress={() => setCount((c) => c + 1)}
        onLongPress={() => setCount((c) => c - 1)}
      >
        <Text>Change</Text>
      </Pressable>
    </View>
  );
}
