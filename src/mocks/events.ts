/**
 * EventEmitter family — mirrors react-native/Libraries/vendor/emitter/EventEmitter
 * and NativeEventEmitter / DeviceEventEmitter semantics for tests.
 */

import { noop } from "./host.ts";

export type EmitterSubscription = {
  remove: () => void;
  listener: (...args: unknown[]) => void;
  context: unknown;
  eventType: string;
};

export class EventEmitter {
  #listeners = new Map<string, Set<EmitterSubscription>>();

  addListener(eventType: string, listener: (...args: unknown[]) => void, context?: unknown): EmitterSubscription {
    const sub: EmitterSubscription = {
      eventType,
      listener,
      context,
      remove: () => this.removeSubscription(sub),
    };
    let set = this.#listeners.get(eventType);
    if (!set) {
      set = new Set();
      this.#listeners.set(eventType, set);
    }
    set.add(sub);
    return sub;
  }

  once(eventType: string, listener: (...args: unknown[]) => void, context?: unknown): EmitterSubscription {
    const sub = this.addListener(
      eventType,
      (...args) => {
        sub.remove();
        listener.apply(context, args);
      },
      context,
    );
    return sub;
  }

  removeAllListeners(eventType?: string): void {
    if (eventType == null) this.#listeners.clear();
    else this.#listeners.delete(eventType);
  }

  removeSubscription(subscription: EmitterSubscription): void {
    const set = this.#listeners.get(subscription.eventType);
    set?.delete(subscription);
  }

  emit(eventType: string, ...args: unknown[]): void {
    const set = this.#listeners.get(eventType);
    if (!set) return;
    for (const sub of [...set]) {
      sub.listener.apply(sub.context, args);
    }
  }

  listenerCount(eventType: string): number {
    return this.#listeners.get(eventType)?.size ?? 0;
  }

  // Legacy aliases used by some RN code paths
  removeListener(eventType: string, listener: (...args: unknown[]) => void): void {
    const set = this.#listeners.get(eventType);
    if (!set) return;
    for (const sub of [...set]) {
      if (sub.listener === listener) set.delete(sub);
    }
  }
}

export class NativeEventEmitter extends EventEmitter {
  constructor(_nativeModule?: unknown) {
    super();
  }

  removeListeners(_count: number): void {
    // no-op parity with RN test mocks
  }
}

export function createDeviceEventEmitter(): EventEmitter {
  return new EventEmitter();
}

export function createKeyboard(emitter: EventEmitter) {
  return {
    dismiss: noop,
    isVisible: () => false,
    metrics: () => null,
    scheduleLayoutAnimation: noop,
    addListener: (event: string, handler: (...args: unknown[]) => void) => emitter.addListener(event, handler),
    removeListener: (event: string, handler: (...args: unknown[]) => void) => emitter.removeListener(event, handler),
    removeAllListeners: (event?: string) => emitter.removeAllListeners(event),
  };
}

export function createBackHandler(emitter: EventEmitter) {
  return {
    exitApp: noop,
    addEventListener: (event: string, handler: (...args: unknown[]) => void) => emitter.addListener(event, handler),
    removeEventListener: (event: string, handler: (...args: unknown[]) => void) =>
      emitter.removeListener(event, handler),
  };
}

export function createAppStateWithEmitter(emitter: EventEmitter) {
  let currentState = "active";
  return {
    get currentState() {
      return currentState;
    },
    set currentState(v: string) {
      currentState = v;
    },
    isAvailable: true,
    addEventListener: (event: string, handler: (...args: unknown[]) => void) => emitter.addListener(event, handler),
  };
}

export function createLinkingWithEmitter(emitter: EventEmitter) {
  return {
    addEventListener: (event: string, handler: (...args: unknown[]) => void) => emitter.addListener(event, handler),
    openURL: (url: string) => Promise.resolve(url.length > 0),
    canOpenURL: () => Promise.resolve(true),
    openSettings: () => Promise.resolve(),
    getInitialURL: () => Promise.resolve(null),
    sendIntent: () => Promise.resolve(),
  };
}
