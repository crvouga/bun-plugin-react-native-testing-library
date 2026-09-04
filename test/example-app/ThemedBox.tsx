import { Platform, StyleSheet, Text, useWindowDimensions, View } from "react-native";

export function ThemedBox() {
  const { width, height } = useWindowDimensions();
  const label = Platform.select({
    ios: "ios-box",
    android: "android-box",
    default: "box",
  });

  return (
    <View testID="themed-box" style={styles.box} accessibilityLabel={label}>
      <Text testID="themed-label">{label}</Text>
      <Text testID="themed-size">
        {width}x{height}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    padding: 8,
    backgroundColor: Platform.select({ ios: "#eef", android: "#efe", default: "#eee" }),
  },
});
