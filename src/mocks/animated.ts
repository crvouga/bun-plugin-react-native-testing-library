/**
 * Animated mock — JS-driven only (native driver forced off).
 * Covers Value/ValueXY, interpolate, compositions, createAnimatedComponent, hooks.
 */

import type * as ReactNS from "react";
import { noop } from "./host.ts";

type Listener = (state: { value: number }) => void;

export class AnimatedValue {
  _value: number;
  #listeners = new Map<string, Listener>();
  #nextId = 0;

  constructor(v = 0) {
    this._value = v;
  }

  setValue(v: number) {
    this._value = v;
    for (const l of this.#listeners.values()) l({ value: v });
  }

  setOffset(_offset: number) {}
  flattenOffset() {}
  extractOffset() {}

  addListener(cb: Listener): string {
    const id = String(this.#nextId++);
    this.#listeners.set(id, cb);
    return id;
  }

  removeListener(id: string) {
    this.#listeners.delete(id);
  }

  removeAllListeners() {
    this.#listeners.clear();
  }

  stopAnimation(cb?: (v: number) => void) {
    cb?.(this._value);
  }

  resetAnimation(cb?: (v: number) => void) {
    cb?.(this._value);
  }

  interpolate(config: {
    inputRange: number[];
    outputRange: Array<number | string>;
    extrapolate?: string;
  }): AnimatedInterpolation {
    return new AnimatedInterpolation(this, config);
  }

  __getValue() {
    return this._value;
  }
}

export class AnimatedInterpolation {
  #parent: AnimatedValue;
  #config: {
    inputRange: number[];
    outputRange: Array<number | string>;
  };

  constructor(
    parent: AnimatedValue,
    config: { inputRange: number[]; outputRange: Array<number | string> },
  ) {
    this.#parent = parent;
    this.#config = config;
  }

  __getValue(): number | string {
    const v = this.#parent.__getValue();
    const { inputRange, outputRange } = this.#config;
    if (inputRange.length === 0) return outputRange[0] ?? 0;
    if (v <= inputRange[0]!) return outputRange[0]!;
    if (v >= inputRange[inputRange.length - 1]!) return outputRange[outputRange.length - 1]!;
    for (let i = 0; i < inputRange.length - 1; i++) {
      const i0 = inputRange[i]!;
      const i1 = inputRange[i + 1]!;
      if (v >= i0 && v <= i1) {
        const t = (v - i0) / (i1 - i0 || 1);
        const o0 = outputRange[i]!;
        const o1 = outputRange[i + 1]!;
        if (typeof o0 === "number" && typeof o1 === "number") {
          return o0 + (o1 - o0) * t;
        }
        return t < 0.5 ? o0 : o1;
      }
    }
    return outputRange[0]!;
  }

  interpolate(config: {
    inputRange: number[];
    outputRange: Array<number | string>;
  }): AnimatedInterpolation {
    // Chain: evaluate parent then map — simplified as new node from parent value
    return new AnimatedInterpolation(this.#parent, config);
  }

  addListener = () => "0";
  removeListener = noop;
  removeAllListeners = noop;
  stopAnimation = noop;
  resetAnimation = noop;
}

export class AnimatedValueXY {
  x: AnimatedValue;
  y: AnimatedValue;

  constructor(value: { x?: number; y?: number } = {}) {
    this.x = new AnimatedValue(value.x ?? 0);
    this.y = new AnimatedValue(value.y ?? 0);
  }

  setValue(v: { x: number; y: number }) {
    this.x.setValue(v.x);
    this.y.setValue(v.y);
  }

  setOffset(v: { x: number; y: number }) {
    this.x.setOffset(v.x);
    this.y.setOffset(v.y);
  }

  flattenOffset() {
    this.x.flattenOffset();
    this.y.flattenOffset();
  }

  extractOffset() {
    this.x.extractOffset();
    this.y.extractOffset();
  }

  stopAnimation(cb?: (v: { x: number; y: number }) => void) {
    cb?.({ x: this.x.__getValue(), y: this.y.__getValue() });
  }

  resetAnimation(cb?: (v: { x: number; y: number }) => void) {
    cb?.({ x: this.x.__getValue(), y: this.y.__getValue() });
  }

  addListener(cb: (v: { x: number; y: number }) => void): string {
    const id = this.x.addListener(() =>
      cb({ x: this.x.__getValue(), y: this.y.__getValue() }),
    );
    this.y.addListener(() => cb({ x: this.x.__getValue(), y: this.y.__getValue() }));
    return id;
  }

  removeListener(id: string) {
    this.x.removeListener(id);
    this.y.removeListener(id);
  }

  removeAllListeners() {
    this.x.removeAllListeners();
    this.y.removeAllListeners();
  }

  getLayout() {
    return { left: this.x, top: this.y };
  }

  getTranslateTransform() {
    return [{ translateX: this.x }, { translateY: this.y }];
  }

  __getValue() {
    return { x: this.x.__getValue(), y: this.y.__getValue() };
  }
}

type Animatable = {
  start: (cb?: (r: { finished: boolean }) => void) => void;
  stop: () => void;
  reset?: () => void;
};

function makeAnim(startFn?: (cb?: (r: { finished: boolean }) => void) => void): Animatable {
  return {
    start: (cb) => {
      if (startFn) startFn(cb);
      else cb?.({ finished: true });
    },
    stop: noop,
    reset: noop,
  };
}

function flattenAnimatedStyle(style: unknown): unknown {
  if (style == null) return style;
  if (Array.isArray(style)) return style.map(flattenAnimatedStyle);
  if (typeof style === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(style as Record<string, unknown>)) {
      if (v && typeof v === "object" && typeof (v as { __getValue?: () => unknown }).__getValue === "function") {
        out[k] = (v as { __getValue: () => unknown }).__getValue();
      } else {
        out[k] = flattenAnimatedStyle(v);
      }
    }
    return out;
  }
  return style;
}

export function createAnimated(
  React: typeof ReactNS,
  hosts: {
    View: ReactNS.ComponentType;
    Text: ReactNS.ComponentType;
    Image: ReactNS.ComponentType;
    ScrollView: ReactNS.ComponentType;
    FlatList: ReactNS.ComponentType;
  },
) {
  function createAnimatedComponent<T extends ReactNS.ComponentType<any>>(Component: T): T {
    const AnimatedComp = React.forwardRef((props: Record<string, unknown>, ref) => {
      const { style, ...rest } = props;
      return React.createElement(Component, {
        ...rest,
        ref,
        style: flattenAnimatedStyle(style),
      });
    });
    AnimatedComp.displayName = `Animated(${(Component as { displayName?: string; name?: string }).displayName ?? (Component as { name?: string }).name ?? "Component"})`;
    return AnimatedComp as unknown as T;
  }

  const Animated = {
    View: createAnimatedComponent(hosts.View),
    Text: createAnimatedComponent(hosts.Text),
    Image: createAnimatedComponent(hosts.Image),
    ScrollView: createAnimatedComponent(hosts.ScrollView),
    FlatList: createAnimatedComponent(hosts.FlatList),
    createAnimatedComponent,
    Value: AnimatedValue,
    ValueXY: AnimatedValueXY,
    sequence: (anims: Animatable[]) =>
      makeAnim((cb) => {
        for (const a of anims) a.start();
        cb?.({ finished: true });
      }),
    parallel: (anims: Animatable[], _cfg?: unknown) =>
      makeAnim((cb) => {
        for (const a of anims) a.start();
        cb?.({ finished: true });
      }),
    stagger: (_delay: number, anims: Animatable[]) =>
      makeAnim((cb) => {
        for (const a of anims) a.start();
        cb?.({ finished: true });
      }),
    loop: (anim: Animatable, config?: { iterations?: number }) => {
      const iterations = config?.iterations ?? -1;
      return makeAnim((cb) => {
        const n = iterations < 0 ? 1 : iterations;
        for (let i = 0; i < n; i++) anim.start();
        cb?.({ finished: true });
      });
    },
    delay: (_ms: number) => makeAnim(),
    timing: (_v: unknown, _cfg?: unknown) => makeAnim(),
    spring: (_v: unknown, _cfg?: unknown) => makeAnim(),
    decay: (_v: unknown, _cfg?: unknown) => makeAnim(),
    event: (_argMapping?: unknown, _config?: unknown) => noop,
    add: (a: unknown, b: unknown) => ({ a, b, __getValue: () => 0 }),
    subtract: (a: unknown, b: unknown) => ({ a, b, __getValue: () => 0 }),
    multiply: (a: unknown, b: unknown) => ({ a, b, __getValue: () => 0 }),
    divide: (a: unknown, b: unknown) => ({ a, b, __getValue: () => 0 }),
    modulo: (a: unknown, b: unknown) => ({ a, b, __getValue: () => 0 }),
    diffClamp: (a: unknown, _min: number, _max: number) => ({ a, __getValue: () => 0 }),
  };

  return Animated;
}

export function createUseAnimatedValue(React: typeof ReactNS) {
  return function useAnimatedValue(initial: number) {
    return React.useRef(new AnimatedValue(initial)).current;
  };
}

export function createUseAnimatedValueXY(React: typeof ReactNS) {
  return function useAnimatedValueXY(initial?: { x?: number; y?: number }) {
    return React.useRef(new AnimatedValueXY(initial)).current;
  };
}

export function createUseAnimatedColor(React: typeof ReactNS) {
  return function useAnimatedColor(initial: string | number = "#000") {
    return React.useRef(
      (() => {
        const node = {
          value: initial as string | number,
          setValue: (v: string | number) => {
            node.value = v;
          },
          __getValue: () => node.value,
        };
        return node;
      })(),
    ).current;
  };
}
