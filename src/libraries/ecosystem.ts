/**
 * High-impact ecosystem shims (maps, video, Firebase, Stripe, keychain, …).
 */

import type { LibraryShim } from "./helpers.ts";
import { mockBoth, loadConsumerReact } from "./helpers.ts";

function unsupported(api: string): never {
  throw new Error(`[rn-bun] ${api} is unsupported in unit tests`);
}

function viewHost(displayName: string) {
  const React = loadConsumerReact();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const RN = require("react-native") as typeof import("react-native");
  const C = ({ children, ...rest }: Record<string, unknown> & { children?: React.ReactNode }) =>
    React.createElement(RN.View, rest, children);
  C.displayName = displayName;
  return C;
}

// ---------------------------------------------------------------------------
// Maps / video / media hosts
// ---------------------------------------------------------------------------

export const mapsShim: LibraryShim = {
  name: "maps",
  packages: ["react-native-maps"],
  register({ cwd }) {
    const MapView = viewHost("MapView");
    const Marker = viewHost("Marker");
    const Callout = viewHost("Callout");
    const Circle = viewHost("Circle");
    const Polygon = viewHost("Polygon");
    const Polyline = viewHost("Polyline");
    Object.assign(MapView, {
      Marker,
      Callout,
      Circle,
      Polygon,
      Polyline,
      PROVIDER_GOOGLE: "google",
      PROVIDER_DEFAULT: "default",
    });
    mockBoth(
      "react-native-maps",
      () => ({
        default: MapView,
        MapView,
        Marker,
        Callout,
        Circle,
        Polygon,
        Polyline,
        PROVIDER_GOOGLE: "google",
        PROVIDER_DEFAULT: "default",
        __esModule: true,
      }),
      cwd,
    );
  },
};

export const videoShim: LibraryShim = {
  name: "video",
  packages: ["react-native-video"],
  register({ cwd }) {
    const Video = viewHost("Video");
    Object.assign(Video, {
      seek: () => {},
      presentFullscreenPlayer: () => {},
      dismissFullscreenPlayer: () => {},
    });
    mockBoth("react-native-video", () => ({ default: Video, Video, __esModule: true }), cwd);
  },
};

export const imagePickerShim: LibraryShim = {
  name: "image-picker",
  packages: ["react-native-image-picker"],
  register({ cwd }) {
    const canceled = { didCancel: true, errorCode: undefined, errorMessage: undefined, assets: undefined };
    const api = {
      launchCamera: async () => ({ ...canceled }),
      launchImageLibrary: async () => ({ ...canceled }),
    };
    mockBoth("react-native-image-picker", () => ({ ...api, default: api, __esModule: true }), cwd);
  },
};

export const shareShim: LibraryShim = {
  name: "share",
  packages: ["react-native-share"],
  register({ cwd }) {
    const open = async (_opts?: unknown) => ({ success: true, message: "shared" });
    const api = {
      open,
      shareSingle: async () => ({ success: true, message: "shared" }),
      isPackageInstalled: async () => true,
      Social: {
        FACEBOOK: "facebook",
        TWITTER: "twitter",
        WHATSAPP: "whatsapp",
        INSTAGRAM: "instagram",
        EMAIL: "email",
      },
    };
    mockBoth("react-native-share", () => ({ default: api, ...api, __esModule: true }), cwd);
  },
};

export const bootsplashShim: LibraryShim = {
  name: "bootsplash",
  packages: ["react-native-bootsplash"],
  register({ cwd }) {
    let visible = true;
    const hide = async (_opts?: unknown) => {
      visible = false;
    };
    const show = async (_opts?: unknown) => {
      visible = true;
    };
    const isVisible = async () => visible;
    const api = { hide, show, isVisible, getVisibilityStatus: async () => (visible ? "visible" : "hidden") };
    mockBoth("react-native-bootsplash", () => ({ ...api, default: api, __esModule: true }), cwd);
  },
};

// ---------------------------------------------------------------------------
// Keychain (behavioral in-memory)
// ---------------------------------------------------------------------------

type KeychainCreds = { username: string; password: string; service?: string };

let keychainStore = new Map<string, KeychainCreds>();

export function __resetKeychainForTests(): void {
  keychainStore = new Map();
}

export function __setKeychainForTests(service: string, creds: KeychainCreds): void {
  keychainStore.set(service || "default", creds);
}

export const keychainShim: LibraryShim = {
  name: "keychain",
  packages: ["react-native-keychain"],
  register({ cwd }) {
    const serviceKey = (opts?: { service?: string } | string) => {
      if (typeof opts === "string") return opts;
      return opts?.service ?? "default";
    };
    const api = {
      setGenericPassword: async (username: string, password: string, opts?: { service?: string }) => {
        keychainStore.set(serviceKey(opts), { username, password, service: serviceKey(opts) });
        return true;
      },
      getGenericPassword: async (opts?: { service?: string }) => {
        const c = keychainStore.get(serviceKey(opts));
        return c ? { ...c, storage: "bun" } : false;
      },
      resetGenericPassword: async (opts?: { service?: string }) => {
        keychainStore.delete(serviceKey(opts));
        return true;
      },
      hasGenericPassword: async (opts?: { service?: string }) => keychainStore.has(serviceKey(opts)),
      getAllGenericPasswordServices: async () => [...keychainStore.keys()],
      setInternetCredentials: async (server: string, username: string, password: string) => {
        keychainStore.set(`internet:${server}`, { username, password, service: server });
        return true;
      },
      getInternetCredentials: async (server: string) => {
        const c = keychainStore.get(`internet:${server}`);
        return c ? { ...c, storage: "bun" } : false;
      },
      resetInternetCredentials: async (server: string) => {
        keychainStore.delete(`internet:${server}`);
        return true;
      },
      ACCESSIBLE: {
        WHEN_UNLOCKED: "AccessibleWhenUnlocked",
        AFTER_FIRST_UNLOCK: "AccessibleAfterFirstUnlock",
        ALWAYS: "AccessibleAlways",
        WHEN_PASSCODE_SET_THIS_DEVICE_ONLY: "AccessibleWhenPasscodeSetThisDeviceOnly",
        WHEN_UNLOCKED_THIS_DEVICE_ONLY: "AccessibleWhenUnlockedThisDeviceOnly",
        AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: "AccessibleAfterFirstUnlockThisDeviceOnly",
      },
      ACCESS_CONTROL: {},
      AUTHENTICATION_TYPE: {},
      SECURITY_LEVEL: {},
      STORAGE_TYPE: {},
    };
    mockBoth("react-native-keychain", () => ({ ...api, default: api, __esModule: true }), cwd);
  },
};

export const biometricsShim: LibraryShim = {
  name: "biometrics",
  packages: ["react-native-biometrics"],
  register({ cwd }) {
    class ReactNativeBiometrics {
      isSensorAvailable = async () => ({ available: true, biometryType: "FaceID" });
      createKeys = async () => ({ publicKey: "bun-test-public-key" });
      deleteKeys = async () => ({ keysDeleted: true });
      createSignature = async () => ({ success: true, signature: "bun-test-sig" });
      simplePrompt = async () => ({ success: true });
      biometricKeysExist = async () => ({ keysExist: false });
    }
    mockBoth(
      "react-native-biometrics",
      () => ({
        default: ReactNativeBiometrics,
        ReactNativeBiometrics,
        BiometryTypes: { TouchID: "TouchID", FaceID: "FaceID", Biometrics: "Biometrics" },
        __esModule: true,
      }),
      cwd,
    );
  },
};

export const configShim: LibraryShim = {
  name: "config",
  packages: ["react-native-config"],
  register({ cwd }) {
    // At least one key — Bun unwraps `default` to the module root, and an empty
    // object would look like `Module {}` to the import-surface scanner.
    const Config: Record<string, string> = { APP_ENV: "test" };
    mockBoth("react-native-config", () => ({ default: Config, Config, __esModule: true }), cwd);
  },
};

export const visionCameraShim: LibraryShim = {
  name: "vision-camera",
  packages: ["react-native-vision-camera"],
  register({ cwd }) {
    const Camera = viewHost("Camera");
    Object.assign(Camera, {
      getAvailableCameraDevices: () => [],
      getCameraPermissionStatus: () => "granted",
      requestCameraPermission: async () => "granted",
      getMicrophonePermissionStatus: () => "granted",
      requestMicrophonePermission: async () => "granted",
    });
    const useCameraDevice = (_pos?: string) => null;
    const useCameraDevices = () => [];
    const useCameraPermission = () => ({
      hasPermission: true,
      requestPermission: async () => true,
    });
    const useMicrophonePermission = () => ({
      hasPermission: true,
      requestPermission: async () => true,
    });
    mockBoth(
      "react-native-vision-camera",
      () => ({
        Camera,
        useCameraDevice,
        useCameraDevices,
        useCameraPermission,
        useMicrophonePermission,
        useFrameProcessor: () => {},
        runAtTargetFps: (_fps: number, fn: () => void) => fn(),
        Templates: {},
        __esModule: true,
      }),
      cwd,
    );
  },
};

// ---------------------------------------------------------------------------
// Firebase family — shared in-memory app lifecycle
// ---------------------------------------------------------------------------

type FirebaseApp = {
  name: string;
  options: Record<string, unknown>;
  delete: () => Promise<void>;
};

const firebaseApps = new Map<string, FirebaseApp>();

export function __resetFirebaseForTests(): void {
  firebaseApps.clear();
}

function getOrCreateApp(name = "[DEFAULT]", options: Record<string, unknown> = {}): FirebaseApp {
  let app = firebaseApps.get(name);
  if (!app) {
    app = {
      name,
      options,
      delete: async () => {
        firebaseApps.delete(name);
      },
    };
    firebaseApps.set(name, app);
  }
  return app;
}

function makeFirebaseModule(service: string, instanceFactory: (app: FirebaseApp) => Record<string, unknown>) {
  const fn = (app?: FirebaseApp) => instanceFactory(app ?? getOrCreateApp());
  Object.assign(fn, {
    app: getOrCreateApp,
    SDK_VERSION: "0.0.0-bun-test",
  });
  return { default: fn, [service]: fn, __esModule: true };
}

export const firebaseAppShim: LibraryShim = {
  name: "firebase-app",
  packages: ["@react-native-firebase/app"],
  register({ cwd }) {
    // Bun's mock.module unwraps `default` as the module namespace, so named
    // catalog exports (e.g. `firebase`) must live on that object.
    const firebase: Record<string, unknown> = {
      app: (name?: string) => getOrCreateApp(name),
      initializeApp: (options: Record<string, unknown>, name = "[DEFAULT]") => getOrCreateApp(name, options),
      SDK_VERSION: "0.0.0-bun-test",
      utils: () => ({
        playServicesAvailability: { isAvailable: true },
      }),
    };
    Object.defineProperty(firebase, "apps", {
      get: () => [...firebaseApps.values()],
      enumerable: true,
    });
    firebase.firebase = firebase;
    mockBoth(
      "@react-native-firebase/app",
      () => ({
        default: firebase,
        firebase,
        getApp: (name?: string) => getOrCreateApp(name),
        getApps: () => [...firebaseApps.values()],
        initializeApp: firebase.initializeApp,
        deleteApp: async (app: FirebaseApp) => app.delete(),
        __esModule: true,
      }),
      cwd,
    );
  },
};

export const firebaseAuthShim: LibraryShim = {
  name: "firebase-auth",
  packages: ["@react-native-firebase/auth"],
  register({ cwd }) {
    let currentUser: Record<string, unknown> | null = null;
    const listeners = new Set<(u: typeof currentUser) => void>();
    const authInstance = (_app: FirebaseApp) => ({
      get currentUser() {
        return currentUser;
      },
      onAuthStateChanged: (cb: (u: typeof currentUser) => void) => {
        listeners.add(cb);
        cb(currentUser);
        return () => listeners.delete(cb);
      },
      signInAnonymously: async () => {
        currentUser = { uid: "anon-bun", isAnonymous: true };
        for (const l of listeners) l(currentUser);
        return { user: currentUser };
      },
      signInWithEmailAndPassword: async (email: string, _password: string) => {
        currentUser = { uid: "email-bun", email, isAnonymous: false };
        for (const l of listeners) l(currentUser);
        return { user: currentUser };
      },
      createUserWithEmailAndPassword: async (email: string, password: string) =>
        authInstance(_app).signInWithEmailAndPassword(email, password),
      signOut: async () => {
        currentUser = null;
        for (const l of listeners) l(null);
      },
      sendPasswordResetEmail: async () => {},
      applyActionCode: async () => unsupported("auth.applyActionCode"),
    });
    mockBoth("@react-native-firebase/auth", () => makeFirebaseModule("auth", authInstance), cwd);
  },
};

export const firebaseFirestoreShim: LibraryShim = {
  name: "firebase-firestore",
  packages: ["@react-native-firebase/firestore"],
  register({ cwd }) {
    const docs = new Map<string, Record<string, unknown>>();
    const firestoreInstance = (_app: FirebaseApp) => {
      const collection = (path: string) => ({
        doc: (id?: string) => {
          const docId = id ?? `auto-${docs.size + 1}`;
          const key = `${path}/${docId}`;
          return {
            id: docId,
            path: key,
            get: async () => ({
              exists: docs.has(key),
              id: docId,
              data: () => docs.get(key),
              ref: { id: docId, path: key },
            }),
            set: async (data: Record<string, unknown>) => {
              docs.set(key, data);
            },
            update: async (data: Record<string, unknown>) => {
              docs.set(key, { ...(docs.get(key) ?? {}), ...data });
            },
            delete: async () => {
              docs.delete(key);
            },
            onSnapshot: (cb: (snap: unknown) => void) => {
              cb({
                exists: docs.has(key),
                id: docId,
                data: () => docs.get(key),
              });
              return () => {};
            },
          };
        },
        add: async (data: Record<string, unknown>) => {
          const id = `auto-${docs.size + 1}`;
          docs.set(`${path}/${id}`, data);
          return { id };
        },
        get: async () => ({
          docs: [...docs.entries()]
            .filter(([k]) => k.startsWith(`${path}/`))
            .map(([k, v]) => ({
              id: k.slice(path.length + 1),
              data: () => v,
              exists: true,
            })),
          empty: ![...docs.keys()].some((k) => k.startsWith(`${path}/`)),
        }),
        where: () => collection(path),
        orderBy: () => collection(path),
        limit: () => collection(path),
      });
      return {
        collection,
        doc: (path: string) => {
          const parts = path.split("/");
          const id = parts.pop()!;
          return collection(parts.join("/")).doc(id);
        },
        batch: () => ({
          set: () => {},
          update: () => {},
          delete: () => {},
          commit: async () => {},
        }),
        runTransaction: async () => unsupported("firestore.runTransaction"),
        settings: () => {},
        clearPersistence: async () => {
          docs.clear();
        },
      };
    };
    mockBoth("@react-native-firebase/firestore", () => makeFirebaseModule("firestore", firestoreInstance), cwd);
  },
};

export const firebaseMessagingShim: LibraryShim = {
  name: "firebase-messaging",
  packages: ["@react-native-firebase/messaging"],
  register({ cwd }) {
    const messagingInstance = (_app: FirebaseApp) => ({
      getToken: async () => "bun-test-fcm-token",
      deleteToken: async () => {},
      onMessage: () => () => {},
      onNotificationOpenedApp: () => () => {},
      onTokenRefresh: () => () => {},
      getInitialNotification: async () => null,
      requestPermission: async () => 1,
      hasPermission: async () => 1,
      subscribeToTopic: async () => {},
      unsubscribeFromTopic: async () => {},
      setBackgroundMessageHandler: () => {},
      isDeviceRegisteredForRemoteMessages: true,
      registerDeviceForRemoteMessages: async () => {},
      unregisterDeviceForRemoteMessages: async () => {},
      AuthorizationStatus: { NOT_DETERMINED: -1, DENIED: 0, AUTHORIZED: 1, PROVISIONAL: 2 },
    });
    mockBoth("@react-native-firebase/messaging", () => makeFirebaseModule("messaging", messagingInstance), cwd);
  },
};

export const firebaseAnalyticsShim: LibraryShim = {
  name: "firebase-analytics",
  packages: ["@react-native-firebase/analytics"],
  register({ cwd }) {
    const analyticsInstance = (_app: FirebaseApp) => ({
      logEvent: async () => {},
      logScreenView: async () => {},
      setUserId: async () => {},
      setUserProperty: async () => {},
      setUserProperties: async () => {},
      setAnalyticsCollectionEnabled: async () => {},
      resetAnalyticsData: async () => {},
      setDefaultEventParameters: async () => {},
    });
    mockBoth("@react-native-firebase/analytics", () => makeFirebaseModule("analytics", analyticsInstance), cwd);
  },
};

export const firebaseCrashlyticsShim: LibraryShim = {
  name: "firebase-crashlytics",
  packages: ["@react-native-firebase/crashlytics"],
  register({ cwd }) {
    const crashlyticsInstance = (_app: FirebaseApp) => ({
      log: () => {},
      recordError: () => {},
      setUserId: async () => {},
      setAttribute: async () => {},
      setAttributes: async () => {},
      setCrashlyticsCollectionEnabled: async () => {},
      crash: () => unsupported("crashlytics.crash"),
      checkForUnsentReports: async () => ({ unsentReports: false }),
      sendUnsentReports: () => {},
      deleteUnsentReports: async () => {},
      didCrashOnPreviousExecution: async () => false,
    });
    mockBoth("@react-native-firebase/crashlytics", () => makeFirebaseModule("crashlytics", crashlyticsInstance), cwd);
  },
};

// ---------------------------------------------------------------------------
// Google Sign-In / Stripe
// ---------------------------------------------------------------------------

export const googleSigninShim: LibraryShim = {
  name: "google-signin",
  packages: ["@react-native-google-signin/google-signin"],
  register({ cwd }) {
    const GoogleSignin = {
      configure: () => {},
      hasPlayServices: async () => true,
      signIn: async () => ({
        type: "success",
        data: {
          idToken: "bun-test-id-token",
          serverAuthCode: null,
          scopes: [],
          user: { id: "bun-user", email: "test@example.com", name: "Test", photo: null },
        },
      }),
      signInSilently: async () => ({ type: "success", data: null }),
      signOut: async () => {},
      revokeAccess: async () => {},
      isSignedIn: async () => false,
      getCurrentUser: async () => null,
      getTokens: async () => ({ accessToken: "bun-access", idToken: "bun-id" }),
      clearCachedAccessToken: async () => {},
      addScopes: async () => null,
    };
    mockBoth(
      "@react-native-google-signin/google-signin",
      () => ({
        GoogleSignin,
        statusCodes: {
          SIGN_IN_CANCELLED: "SIGN_IN_CANCELLED",
          IN_PROGRESS: "IN_PROGRESS",
          PLAY_SERVICES_NOT_AVAILABLE: "PLAY_SERVICES_NOT_AVAILABLE",
          SIGN_IN_REQUIRED: "SIGN_IN_REQUIRED",
        },
        isSuccessResponse: (r: { type?: string }) => r?.type === "success",
        isErrorWithCode: () => false,
        __esModule: true,
      }),
      cwd,
    );
  },
};

export const stripeShim: LibraryShim = {
  name: "stripe",
  packages: ["@stripe/stripe-react-native"],
  register({ cwd }) {
    const React = loadConsumerReact();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const RN = require("react-native") as typeof import("react-native");
    const StripeProvider = ({ children, ...rest }: Record<string, unknown> & { children?: React.ReactNode }) =>
      React.createElement(RN.View, rest, children);
    StripeProvider.displayName = "StripeProvider";
    const useStripe = () => ({
      initPaymentSheet: async () => ({ error: undefined }),
      presentPaymentSheet: async () => ({ error: undefined }),
      confirmPayment: async () => ({ error: undefined, paymentIntent: null }),
      createPaymentMethod: async () => ({ error: undefined, paymentMethod: null }),
      createToken: async () => ({ error: undefined, token: null }),
      handleURLCallback: async () => false,
      isPlatformPaySupported: async () => false,
      confirmPlatformPayPayment: async () => unsupported("stripe.confirmPlatformPayPayment"),
    });
    const useConfirmPayment = () => ({ confirmPayment: async () => ({ error: undefined }), loading: false });
    const CardField = viewHost("CardField");
    mockBoth(
      "@stripe/stripe-react-native",
      () => ({
        StripeProvider,
        useStripe,
        useConfirmPayment,
        CardField,
        ApplePayButton: viewHost("ApplePayButton"),
        GooglePayButton: viewHost("GooglePayButton"),
        AuBECSDebitForm: viewHost("AuBECSDebitForm"),
        initStripe: async () => {},
        PaymentSheet: {},
        __esModule: true,
      }),
      cwd,
    );
  },
};
