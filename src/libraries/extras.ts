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
 * Optional svg deep-path: ensure Touchable is visible (handled on public API).
 */
export const svgShim: LibraryShim = {
  name: "svg",
  packages: ["react-native-svg"],
  register() {
    // Real react-native-svg JS loads once Touchable.Mixin exists on the RN mock.
  },
};
