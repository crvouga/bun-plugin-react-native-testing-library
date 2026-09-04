/**
 * Expo UI / media package behavioral shims (opportunistic per package).
 */

import type { LibraryShim } from "../helpers.ts";
import { mockBoth, loadConsumerReact, packageResolves } from "../helpers.ts";
import { createHostComponent, asyncNoop, noop } from "../../mocks/host.ts";

export const expoUiShim: LibraryShim = {
  name: "expo-ui",
  packages: ["expo-modules-core"],
  register({ cwd }) {
    const React = loadConsumerReact();
    const View = createHostComponent(React, "View");
    const Text = createHostComponent(React, "Text");
    const ImageHost = createHostComponent(React, "Image");
    const maybe = (spec: string, factory: () => unknown) => {
      if (packageResolves(spec, cwd)) mockBoth(spec, factory, cwd);
    };

    maybe("expo-status-bar", () => ({
      StatusBar: View,
      setStatusBarStyle: noop,
      setStatusBarHidden: noop,
      setStatusBarBackgroundColor: noop,
      setStatusBarNetworkActivityIndicatorVisible: noop,
    }));

    maybe("expo-splash-screen", () => ({
      preventAutoHideAsync: async () => true,
      hideAsync: asyncNoop,
      hide: noop,
      setOptions: noop,
    }));

    maybe("expo-font", () => {
      const loaded = new Set<string>();
      return {
        useFonts: (map: Record<string, unknown>) => {
          for (const k of Object.keys(map ?? {})) loaded.add(k);
          return [true, null] as const;
        },
        isLoaded: (_name: string) => true,
        isLoading: () => false,
        loadAsync: async (map: Record<string, unknown>) => {
          for (const k of Object.keys(map ?? {})) loaded.add(k);
        },
        processFontFamily: (f: string) => f,
      };
    });

    maybe("expo-linear-gradient", () => ({ LinearGradient: View, default: View }));
    maybe("expo-blur", () => ({ BlurView: View, default: View }));

    maybe("expo-image", () => {
      const ExpoImage = class extends React.Component<Record<string, unknown>> {
        static displayName = "ExpoImage";
        componentDidMount() {
          const onLoad = this.props.onLoad as ((e: unknown) => void) | undefined;
          onLoad?.({ source: { width: 100, height: 100 } });
        }
        render() {
          return React.createElement(ImageHost, this.props);
        }
      };
      return { Image: ExpoImage, default: ExpoImage };
    });

    maybe("@expo/vector-icons", () => {
      const make = (set: string) => {
        const Icon = (props: { name?: string; testID?: string }) =>
          React.createElement(Text, { testID: props.testID ?? `icon-${set}` }, props.name ?? set);
        (Icon as { glyphMap?: Record<string, number> }).glyphMap = {};
        return Icon;
      };
      return {
        Ionicons: make("Ionicons"),
        MaterialIcons: make("MaterialIcons"),
        FontAwesome: make("FontAwesome"),
        createIconSet: () => make("Custom"),
        createIconSetFromIcoMoon: () => make("IcoMoon"),
        createIconSetFromFontello: () => make("Fontello"),
      };
    });

    maybe("expo-camera", () => {
      const CameraView = createHostComponent(React, "CameraView");
      const useCameraPermissions = () =>
        [
          { granted: true, status: "granted", canAskAgain: true, expires: "never" },
          async () => ({ granted: true, status: "granted" }),
        ] as const;
      return {
        CameraView,
        Camera: CameraView,
        useCameraPermissions,
        useMicrophonePermissions: useCameraPermissions,
        requestCameraPermissionsAsync: async () => ({ granted: true, status: "granted" }),
        getCameraPermissionsAsync: async () => ({ granted: true, status: "granted" }),
        Constants: { Type: { front: "front", back: "back" } },
      };
    });

    maybe("expo-av", () => {
      class Sound {
        static createAsync = async () => ({ sound: new Sound(), status: { isLoaded: true } });
        playAsync = asyncNoop;
        pauseAsync = asyncNoop;
        stopAsync = asyncNoop;
        unloadAsync = asyncNoop;
        setPositionAsync = asyncNoop;
        setVolumeAsync = asyncNoop;
        getStatusAsync = async () => ({ isLoaded: true, isPlaying: false });
      }
      return {
        Audio: { Sound, setAudioModeAsync: asyncNoop },
        Video: View,
        ResizeMode: { CONTAIN: "contain", COVER: "cover", STRETCH: "stretch" },
      };
    });

    maybe("expo-audio", () => ({
      useAudioPlayer: () => ({
        play: noop,
        pause: noop,
        seekTo: noop,
        remove: noop,
        playing: false,
        isLoaded: true,
      }),
      createAudioPlayer: () => ({ play: noop, pause: noop, remove: noop }),
      setAudioModeAsync: asyncNoop,
    }));
  },
};
