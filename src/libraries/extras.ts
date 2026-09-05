import type { LibraryShim } from "./helpers.ts";
import { mockBoth, loadConsumerReact } from "./helpers.ts";

/**
 * react-native-linear-gradient ships `import { type Props }` in index.ios.js,
 * which Bun's JS parser rejects. Provide a View-based shim.
 */
export const linearGradientShim: LibraryShim = {
  name: "linear-gradient",
  packages: ["react-native-linear-gradient"],
  register({ cwd }) {
    const React = loadConsumerReact();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const RN = require("react-native") as typeof import("react-native");
    const LinearGradient = ({ children, ...rest }: Record<string, unknown> & { children?: React.ReactNode }) =>
      React.createElement(RN.View, rest, children);
    LinearGradient.displayName = "LinearGradient";
    mockBoth("react-native-linear-gradient", () => ({ default: LinearGradient, __esModule: true }), cwd);
  },
};

/**
 * WebView's platform entry prints "does not support this platform" under Bun.
 */
export const webviewShim: LibraryShim = {
  name: "webview",
  packages: ["react-native-webview"],
  register({ cwd }) {
    const React = loadConsumerReact();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const RN = require("react-native") as typeof import("react-native");
    class WebView extends React.Component<Record<string, unknown>> {
      static displayName = "WebView";
      injectJavaScript = () => {};
      goBack = () => {};
      goForward = () => {};
      reload = () => {};
      stopLoading = () => {};
      requestFocus = () => {};
      postMessage = () => {};
      render() {
        return React.createElement(RN.View, this.props);
      }
    }
    mockBoth("react-native-webview", () => ({ default: WebView, WebView, __esModule: true }), cwd);
  },
};

/**
 * react-native-svg often loads once Touchable.Mixin exists, but under Bun it
 * still hits Flow `typeof` on some deep paths. Always provide a host mock so
 * imports are stable; real-world svg tests can still exercise the real tree
 * when the package loads via consumer entry without going through this factory
 * recursion path.
 */
export const svgShim: LibraryShim = {
  name: "svg",
  packages: ["react-native-svg"],
  register({ cwd }) {
    const React = loadConsumerReact();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const RN = require("react-native") as typeof import("react-native");

    const host = (name: string) => {
      const C = ({ children, ...rest }: Record<string, unknown> & { children?: React.ReactNode }) =>
        React.createElement(RN.View, rest, children);
      C.displayName = name;
      return C;
    };

    const Svg = host("Svg");
    const api = {
      default: Svg,
      Svg,
      Circle: host("Circle"),
      Path: host("Path"),
      Rect: host("Rect"),
      G: host("G"),
      Line: host("Line"),
      Text: host("SvgText"),
      Defs: host("Defs"),
      ClipPath: host("ClipPath"),
      LinearGradient: host("SvgLinearGradient"),
      RadialGradient: host("SvgRadialGradient"),
      Stop: host("Stop"),
      Polygon: host("Polygon"),
      Polyline: host("Polyline"),
      Ellipse: host("Ellipse"),
      TSpan: host("TSpan"),
      __esModule: true,
    };
    mockBoth("react-native-svg", () => api, cwd);
  },
};
