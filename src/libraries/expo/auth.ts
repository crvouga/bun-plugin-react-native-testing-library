/**
 * Expo auth / browser shims (separate registry names for catalog mapping).
 */

import type { LibraryShim } from "../helpers.ts";
import { mockBoth, loadConsumerReact } from "../helpers.ts";

export const expoWebBrowserShim: LibraryShim = {
  name: "expo-web-browser",
  packages: ["expo-web-browser"],
  register({ cwd }) {
    const api = {
      openBrowserAsync: async (url: string) => ({ type: "opened", url }),
      openAuthSessionAsync: async (url: string, _redirect?: string) => ({ type: "success", url }),
      dismissBrowser: async () => {},
      dismissAuthSession: () => {},
      maybeCompleteAuthSession: () => ({ type: "success" as const }),
      warmUpAsync: async () => {},
      coolDownAsync: async () => {},
      getCustomTabsSupportingBrowsersAsync: async () => ({ browserPackages: [] }),
      WebBrowserResultType: {
        CANCEL: "cancel",
        DISMISS: "dismiss",
        OPENED: "opened",
        LOCKED: "locked",
      },
    };
    mockBoth("expo-web-browser", () => ({ ...api, default: api, __esModule: true }), cwd);
  },
};

export const expoAuthSessionShim: LibraryShim = {
  name: "expo-auth-session",
  packages: ["expo-auth-session"],
  register({ cwd }) {
    const React = loadConsumerReact();
    const makeRedirectUri = (opts?: { scheme?: string; path?: string }) => {
      const scheme = opts?.scheme ?? "yourscheme";
      const path = opts?.path ?? "";
      return `${scheme}://${path.replace(/^\//, "")}`;
    };
    const useAuthRequest = (
      _config?: unknown,
      _discovery?: unknown,
    ): [
      { url: string; codeVerifier?: string } | null,
      { type: string; params?: Record<string, string> } | null,
      () => Promise<{ type: string }>,
    ] => {
      const [request] = React.useState(() => ({
        url: "https://example.com/oauth",
        codeVerifier: "bun-code-verifier",
      }));
      const [response] = React.useState(null);
      const promptAsync = async () => ({ type: "dismiss" as const });
      return [request, response, promptAsync];
    };
    const useAutoDiscovery = (_issuer: string) => null;
    const AuthRequest = class {
      url = "https://example.com/oauth";
      async promptAsync() {
        return { type: "dismiss" };
      }
    };
    mockBoth(
      "expo-auth-session",
      () => ({
        useAuthRequest,
        useAutoDiscovery,
        makeRedirectUri,
        AuthRequest,
        AuthSession: {
          getDefaultReturnUrl: () => makeRedirectUri(),
          getRedirectUrl: () => makeRedirectUri(),
          dismiss: () => {},
        },
        ResponseType: { Code: "code", Token: "token", IdToken: "id_token" },
        Prompt: { Login: "login", Consent: "consent", None: "none", SelectAccount: "select_account" },
        __esModule: true,
      }),
      cwd,
    );
  },
};
