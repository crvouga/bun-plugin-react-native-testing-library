/**
 * NativeModules stub — behaviour-minimal port of
 * `@react-native/jest-preset/jest/mocks/NativeModules.js` (MIT, Meta).
 */

import type { WindowMetrics } from "../config.ts";
import { noop } from "./host.ts";

export function createNativeModules(window: WindowMetrics) {
  const dims = {
    window: { ...window },
    screen: { ...window },
  };

  return {
    AlertManager: { alertWithArgs: noop },
    AsyncLocalStorage: {
      multiGet: (_keys: unknown, cb: (err: null, result: unknown[]) => void) =>
        process.nextTick(() => cb(null, [])),
      multiSet: (_e: unknown, cb: (err: null) => void) => process.nextTick(() => cb(null)),
      multiRemove: (_k: unknown, cb: (err: null) => void) => process.nextTick(() => cb(null)),
      multiMerge: (_e: unknown, cb: (err: null) => void) => process.nextTick(() => cb(null)),
      clear: (cb: (err: null) => void) => process.nextTick(() => cb(null)),
      getAllKeys: (cb: (err: null, keys: string[]) => void) => process.nextTick(() => cb(null, [])),
    },
    DeviceInfo: {
      getConstants() {
        return { Dimensions: dims };
      },
    },
    DevSettings: { addMenuItem: noop, reload: noop },
    ImageLoader: {
      getSize: (_url: string) => Promise.resolve([320, 240]),
      getSizeWithHeaders: () => Promise.resolve({ height: 222, width: 333 }),
      prefetchImage: noop,
      prefetchImageWithMetadata: noop,
      queryCache: noop,
    },
    ImageViewManager: {
      getSize: (_uri: string, success: (w: number, h: number) => void) =>
        process.nextTick(() => success(320, 240)),
      prefetchImage: noop,
    },
    KeyboardObserver: { addListener: noop, removeListeners: noop },
    NativeAnimatedModule: {
      createAnimatedNode: noop,
      updateAnimatedNodeConfig: noop,
      getValue: noop,
      startListeningToAnimatedNodeValue: noop,
      stopListeningToAnimatedNodeValue: noop,
      connectAnimatedNodes: noop,
      disconnectAnimatedNodes: noop,
      startAnimatingNode: (
        _id: number,
        _tag: number,
        _config: unknown,
        endCallback: (result: { finished: boolean }) => void,
      ) => {
        setTimeout(() => endCallback({ finished: true }), 16);
      },
      stopAnimation: noop,
      setAnimatedNodeValue: noop,
      setAnimatedNodeOffset: noop,
      flattenAnimatedNodeOffset: noop,
      extractAnimatedNodeOffset: noop,
      connectAnimatedNodeToView: noop,
      disconnectAnimatedNodeFromView: noop,
      restoreDefaultValues: noop,
      dropAnimatedNode: noop,
      addAnimatedEventToView: noop,
      removeAnimatedEventFromView: noop,
      addListener: noop,
      removeListeners: noop,
    },
    Networking: {
      sendRequest: noop,
      abortRequest: noop,
      addListener: noop,
      removeListeners: noop,
    },
    PlatformConstants: {
      getConstants() {
        return {
          isTesting: true,
          reactNativeVersion: { major: 0, minor: 87, patch: 1, prerelease: null },
        };
      },
    },
    PushNotificationManager: {
      presentLocalNotification: noop,
      scheduleLocalNotification: noop,
      cancelAllLocalNotifications: noop,
      removeAllDeliveredNotifications: noop,
      getDeliveredNotifications: (cb: (n: unknown[]) => void) => cb([]),
      removeDeliveredNotifications: noop,
      setApplicationIconBadgeNumber: noop,
      getApplicationIconBadgeNumber: (cb: (n: number) => void) => cb(0),
      cancelLocalNotifications: noop,
      getScheduledLocalNotifications: (cb: (n: unknown[]) => void) => cb([]),
      requestPermissions: () => Promise.resolve({ alert: true, badge: true, sound: true }),
      abandonPermissions: noop,
      checkPermissions: (cb: (p: unknown) => void) =>
        cb({ alert: true, badge: true, sound: true }),
      getInitialNotification: () => Promise.resolve(null),
      addListener: noop,
      removeListeners: noop,
    },
    SourceCode: {
      getConstants() {
        return { scriptURL: null };
      },
    },
    StatusBarManager: {
      setColor: noop,
      setStyle: noop,
      setHidden: noop,
      setNetworkActivityIndicatorVisible: noop,
      setBackgroundColor: noop,
      setTranslucent: noop,
      getConstants: () => ({ HEIGHT: 42 }),
    },
    Timing: {
      createTimer: noop,
      deleteTimer: noop,
    },
    UIManager: {},
    BlobModule: {
      getConstants: () => ({ BLOB_URI_SCHEME: "content", BLOB_URI_HOST: null }),
      addNetworkingHandler: noop,
      enableBlobSupport: noop,
      disableBlobSupport: noop,
      createFromParts: noop,
      sendBlob: noop,
      release: noop,
    },
    WebSocketModule: {
      connect: noop,
      send: noop,
      sendBinary: noop,
      ping: noop,
      close: noop,
      addListener: noop,
      removeListeners: noop,
    },
    I18nManager: {
      allowRTL: noop,
      forceRTL: noop,
      swapLeftAndRightInRTL: noop,
      getConstants: () => ({
        isRTL: false,
        doLeftAndRightSwapInRTL: true,
      }),
    },
  };
}
