/**
 * Host components with realistic RN output for RNTL queries/matchers.
 * Pressable/Touchables/Button render accessible View hosts (not custom types).
 */

import type * as ReactNS from "react";
import { createHostComponent, noop } from "./host.ts";

type PressHandlers = {
  onPress?: (e: unknown) => void;
  onLongPress?: (e: unknown) => void;
  onPressIn?: (e: unknown) => void;
  onPressOut?: (e: unknown) => void;
  disabled?: boolean;
};

function pressProps(props: PressHandlers & Record<string, unknown>) {
  const { onPress, onLongPress, onPressIn, onPressOut, disabled, ...rest } = props;
  const isDisabled = Boolean(disabled);
  return {
    rest,
    host: {
      accessible: rest.accessible !== false,
      accessibilityRole: rest.accessibilityRole ?? rest.role,
      accessibilityState: {
        ...(typeof rest.accessibilityState === "object" && rest.accessibilityState
          ? (rest.accessibilityState as object)
          : {}),
        disabled: isDisabled,
      },
      disabled: isDisabled,
      onPress: isDisabled ? undefined : onPress,
      onLongPress: isDisabled ? undefined : onLongPress,
      onPressIn: isDisabled ? undefined : onPressIn,
      onPressOut: isDisabled ? undefined : onPressOut,
    },
  };
}

export function createComponents(React: typeof ReactNS) {
  const View = createHostComponent(React, "View");
  const Text = createHostComponent(React, "Text");

  const TextInput = class TextInput extends React.Component<
    Record<string, unknown> & {
      value?: string;
      defaultValue?: string;
      onChangeText?: (t: string) => void;
      onChange?: (e: unknown) => void;
      onSubmitEditing?: (e: unknown) => void;
      onFocus?: (e: unknown) => void;
      onBlur?: (e: unknown) => void;
      children?: ReactNS.ReactNode;
    }
  > {
    static displayName = "TextInput";
    isFocused = () => false;
    clear = noop;
    focus = noop;
    blur = noop;
    setNativeProps = noop;
    render() {
      const { children, ...rest } = this.props;
      return React.createElement("TextInput", rest, children);
    }
  };

  const Image = createHostComponent(React, "Image", {
    statics: {
      getSize: (_u: string, ok: (w: number, h: number) => void, _err?: (e: Error) => void) => ok(320, 240),
      getSizeWithHeaders: (_u: string, _h: unknown, ok: (w: number, h: number) => void) => ok(320, 240),
      prefetch: () => Promise.resolve(true),
      abortPrefetch: noop,
      queryCache: () => Promise.resolve({}),
      resolveAssetSource: (s: unknown) => s,
    },
  });

  const ScrollView = class ScrollView extends React.Component<
    Record<string, unknown> & {
      children?: ReactNS.ReactNode;
      refreshControl?: ReactNS.ReactNode;
    }
  > {
    static displayName = "ScrollView";
    scrollTo = noop;
    scrollToEnd = noop;
    flashScrollIndicators = noop;
    getScrollResponder = () => this;
    getScrollableNode = () => null;
    render() {
      const { children, refreshControl, ...rest } = this.props;
      return React.createElement("RCTScrollView", rest, refreshControl, React.createElement(View, null, children));
    }
  };

  const Pressable = class Pressable extends React.Component<
    PressHandlers &
      Record<string, unknown> & {
        children?: ReactNS.ReactNode | ((state: { pressed: boolean }) => ReactNS.ReactNode);
      }
  > {
    static displayName = "Pressable";
    render() {
      const { children, ...props } = this.props;
      const { rest, host } = pressProps(props);
      const child = typeof children === "function" ? children({ pressed: false }) : children;
      return React.createElement(
        "View",
        {
          ...rest,
          ...host,
          accessibilityRole: host.accessibilityRole ?? "button",
        },
        child,
      );
    }
  };

  function makeTouchable(name: string) {
    return class Touchable extends React.Component<
      PressHandlers & Record<string, unknown> & { children?: ReactNS.ReactNode }
    > {
      static displayName = name;
      render() {
        const { children, ...props } = this.props;
        const { rest, host } = pressProps(props);
        return React.createElement("View", { ...rest, ...host }, children);
      }
    };
  }

  const TouchableOpacity = makeTouchable("TouchableOpacity");
  const TouchableHighlight = makeTouchable("TouchableHighlight");
  const TouchableWithoutFeedback = makeTouchable("TouchableWithoutFeedback");
  const TouchableNativeFeedback = makeTouchable("TouchableNativeFeedback");

  const Button = class Button extends React.Component<{
    title: string;
    onPress?: (e: unknown) => void;
    disabled?: boolean;
    testID?: string;
    color?: string;
    accessibilityLabel?: string;
    [key: string]: unknown;
  }> {
    static displayName = "Button";
    render() {
      const { title, onPress, disabled, testID, accessibilityLabel, color, ...rest } = this.props;
      const isDisabled = Boolean(disabled);
      return React.createElement(
        "View",
        {
          ...rest,
          testID,
          accessible: true,
          accessibilityRole: "button",
          accessibilityLabel: accessibilityLabel ?? title,
          accessibilityState: { disabled: isDisabled },
          disabled: isDisabled,
          onPress: isDisabled ? undefined : onPress,
          style: color ? { backgroundColor: color } : undefined,
        },
        React.createElement(Text, null, title),
      );
    }
  };

  const Modal = class Modal extends React.Component<
    Record<string, unknown> & {
      visible?: boolean;
      children?: ReactNS.ReactNode;
    }
  > {
    static displayName = "Modal";
    render() {
      const { visible = true, children, ...rest } = this.props;
      if (visible === false) return null;
      return React.createElement("Modal", rest, children);
    }
  };

  const Switch = class Switch extends React.Component<
    Record<string, unknown> & {
      value?: boolean;
      onValueChange?: (v: boolean) => void;
      disabled?: boolean;
      children?: ReactNS.ReactNode;
    }
  > {
    static displayName = "Switch";
    render() {
      const { children, value, onValueChange, disabled, ...rest } = this.props;
      const isDisabled = Boolean(disabled);
      return React.createElement(
        "RCTSwitch",
        {
          ...rest,
          value: Boolean(value),
          disabled: isDisabled,
          accessibilityRole: rest.accessibilityRole ?? "switch",
          accessibilityState: {
            checked: Boolean(value),
            disabled: isDisabled,
          },
          onChange: isDisabled
            ? undefined
            : (e: { nativeEvent?: { value?: boolean } }) => {
                const next = e?.nativeEvent?.value ?? !value;
                onValueChange?.(Boolean(next));
              },
          onValueChange: isDisabled ? undefined : onValueChange,
        },
        children,
      );
    }
  };

  const ImageBackground = class ImageBackground extends React.Component<
    Record<string, unknown> & { children?: ReactNS.ReactNode; source?: unknown }
  > {
    static displayName = "ImageBackground";
    render() {
      const { children, style, imageStyle, source, ...rest } = this.props;
      return React.createElement(
        View,
        { ...rest, style },
        React.createElement(Image, { source, style: imageStyle }),
        children,
      );
    }
  };

  const ActivityIndicator = createHostComponent(React, "ActivityIndicator");
  const RefreshControl = createHostComponent(React, "RefreshControl");
  const SafeAreaView = createHostComponent(React, "SafeAreaView");
  const KeyboardAvoidingView = createHostComponent(React, "KeyboardAvoidingView");
  const InputAccessoryView = createHostComponent(React, "InputAccessoryView");
  const DrawerLayoutAndroid = createHostComponent(React, "DrawerLayoutAndroid");
  const ProgressBarAndroid = createHostComponent(React, "ProgressBarAndroid");
  const StatusBar = createHostComponent(React, "StatusBar", {
    statics: {
      setBarStyle: noop,
      setHidden: noop,
      setNetworkActivityIndicatorVisible: noop,
      setBackgroundColor: noop,
      setTranslucent: noop,
      currentHeight: 0,
    },
  });

  return {
    View,
    Text,
    TextInput,
    Image,
    ScrollView,
    Pressable,
    TouchableOpacity,
    TouchableHighlight,
    TouchableWithoutFeedback,
    TouchableNativeFeedback,
    Button,
    Modal,
    Switch,
    ImageBackground,
    ActivityIndicator,
    RefreshControl,
    SafeAreaView,
    KeyboardAvoidingView,
    InputAccessoryView,
    DrawerLayoutAndroid,
    ProgressBarAndroid,
    StatusBar,
  };
}
