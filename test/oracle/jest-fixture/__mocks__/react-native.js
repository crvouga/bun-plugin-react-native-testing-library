/**
 * Jest mock for react-native — RN 0.87 no longer ships jest-preset/mock.
 * Mirrors the Bun plugin’s host-output shape enough for RNTL queries:
 * Pressable/Touchables render accessible View hosts (not custom types).
 */
const React = require("react");

function host(name) {
  const C = React.forwardRef((props, ref) => {
    const { children, ...rest } = props;
    return React.createElement(name, { ...rest, ref }, children);
  });
  C.displayName = name;
  return C;
}

function pressableHost(displayName, defaultRole) {
  const C = React.forwardRef((props, ref) => {
    const {
      children,
      disabled,
      accessible,
      accessibilityRole,
      role,
      accessibilityState,
      onPress,
      onLongPress,
      onPressIn,
      onPressOut,
      ...rest
    } = props;
    const isDisabled = Boolean(disabled);
    const child = typeof children === "function" ? children({ pressed: false }) : children;
    return React.createElement(
      "View",
      {
        ...rest,
        ref,
        accessible: accessible !== false,
        accessibilityRole: accessibilityRole ?? role ?? defaultRole,
        accessibilityState: {
          ...(typeof accessibilityState === "object" && accessibilityState ? accessibilityState : {}),
          disabled: isDisabled,
        },
        disabled: isDisabled,
        onPress: isDisabled ? undefined : onPress,
        onLongPress: isDisabled ? undefined : onLongPress,
        onPressIn: isDisabled ? undefined : onPressIn,
        onPressOut: isDisabled ? undefined : onPressOut,
      },
      child,
    );
  });
  C.displayName = displayName;
  return C;
}

const View = host("View");
const Text = host("Text");
const TextInput = host("TextInput");
const Pressable = pressableHost("Pressable", "button");
const ScrollView = host("RCTScrollView");
const Image = host("Image");
const TouchableOpacity = pressableHost("TouchableOpacity", undefined);
const TouchableHighlight = pressableHost("TouchableHighlight", undefined);
const TouchableWithoutFeedback = pressableHost("TouchableWithoutFeedback", undefined);
const Button = React.forwardRef((props, ref) => {
  const { title, onPress, disabled, testID, accessibilityLabel, color, ...rest } = props;
  const isDisabled = Boolean(disabled);
  return React.createElement(
    "View",
    {
      ...rest,
      ref,
      testID,
      accessible: true,
      accessibilityRole: "button",
      accessibilityLabel: accessibilityLabel ?? title,
      accessibilityState: { disabled: isDisabled },
      disabled: isDisabled,
      onPress: isDisabled ? undefined : onPress,
      style: color ? { backgroundColor: color } : undefined,
    },
    React.createElement("Text", null, title),
  );
});
Button.displayName = "Button";

const StyleSheet = {
  create: (styles) => styles,
  flatten: (style) => Object.assign({}, ...(Array.isArray(style) ? style : [style])),
  hairlineWidth: 1,
  absoluteFill: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 },
  absoluteFillObject: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 },
};

const Platform = {
  OS: "ios",
  select: (obj) => obj.ios ?? obj.native ?? obj.default,
  Version: 17,
};

const Dimensions = {
  get: () => ({ width: 390, height: 844, scale: 3, fontScale: 1 }),
  addEventListener: () => ({ remove: () => {} }),
  removeEventListener: () => {},
};

const NativeModules = {};
const TurboModuleRegistry = { get: () => null, getEnforcing: () => ({}) };

module.exports = {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Image,
  Button,
  TouchableOpacity,
  TouchableHighlight,
  TouchableWithoutFeedback,
  StyleSheet,
  Platform,
  Dimensions,
  NativeModules,
  TurboModuleRegistry,
  Alert: { alert: () => {} },
  AppState: { currentState: "active", addEventListener: () => ({ remove: () => {} }) },
  Linking: { openURL: async () => {}, addEventListener: () => ({ remove: () => {} }) },
  PixelRatio: { get: () => 3, roundToNearestPixel: (n) => n },
  I18nManager: { isRTL: false },
  useWindowDimensions: () => ({ width: 390, height: 844, scale: 3, fontScale: 1 }),
  useColorScheme: () => "light",
};
