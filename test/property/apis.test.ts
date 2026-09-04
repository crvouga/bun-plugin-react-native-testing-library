/**
 * Property: Animated Value / compositions / StyleSheet / Platform / EventEmitter.
 */

import { describe, expect, test } from "bun:test";
import { Animated, StyleSheet, Platform, PermissionsAndroid, PanResponder } from "react-native";
import { EventEmitter } from "../../src/mocks/events.ts";
import { resolveConfig } from "../../src/config.ts";
import { createPlatform } from "../../src/mocks/Platform.ts";
import { createDimensions } from "../../src/mocks/Dimensions.ts";
import * as fc from "fast-check";
import { fcOpts } from "../fc-opts.ts";

describe("property: Animated", () => {
  test("Value setValue notifies listeners; interpolate is deterministic", () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 100, noNaN: true }),
        fc.float({ min: 0, max: 100, noNaN: true }),
        (initial, next) => {
          const v = new Animated.Value(initial);
          let heard = initial;
          v.addListener(({ value }) => {
            heard = value;
          });
          v.setValue(next);
          expect(heard).toBe(next);
          expect(v.__getValue()).toBe(next);

          const interp = v.interpolate({
            inputRange: [0, 100],
            outputRange: [0, 1],
          });
          const out = interp.__getValue();
          expect(typeof out === "number" || typeof out === "string").toBe(true);
        },
      ),
      fcOpts,
    );
  });

  test("compositions invoke start callback exactly once with finished:true", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("sequence", "parallel", "stagger", "loop", "timing", "spring", "delay"),
        (kind) => {
          const v = new Animated.Value(0);
          const a = Animated.timing(v, { toValue: 1, duration: 100, useNativeDriver: false });
          let anim;
          switch (kind) {
            case "sequence":
              anim = Animated.sequence([a, a]);
              break;
            case "parallel":
              anim = Animated.parallel([a, a]);
              break;
            case "stagger":
              anim = Animated.stagger(10, [a, a]);
              break;
            case "loop":
              anim = Animated.loop(a, { iterations: 1 });
              break;
            case "delay":
              anim = Animated.delay(1);
              break;
            case "spring":
              anim = Animated.spring(v, { toValue: 1, useNativeDriver: false });
              break;
            default:
              anim = a;
          }
          let calls = 0;
          let finished = false;
          anim.start(({ finished: f }) => {
            calls++;
            finished = f;
          });
          expect(calls).toBe(1);
          expect(finished).toBe(true);
        },
      ),
      fcOpts,
    );
  });
});

describe("property: StyleSheet / Platform / APIs", () => {
  test("StyleSheet.flatten left-folds nested arrays", () => {
    const flattenRef = (style: unknown): Record<string, unknown> => {
      if (style == null || style === false) return {};
      if (Array.isArray(style)) {
        return Object.assign({}, ...style.filter(Boolean).map(flattenRef));
      }
      if (typeof style === "object") return style as Record<string, unknown>;
      return {};
    };

    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(null),
          fc.constant(false),
          fc.constant(undefined),
          fc.dictionary(fc.stringMatching(/^[a-z]{1,4}$/), fc.integer()),
          fc.array(
            fc.oneof(
              fc.constant(null),
              fc.constant(false),
              fc.dictionary(fc.stringMatching(/^[a-z]{1,4}$/), fc.integer()),
            ),
            { maxLength: 4 },
          ),
        ),
        (style) => {
          expect(StyleSheet.flatten(style)).toEqual(flattenRef(style));
        },
      ),
      fcOpts,
    );
  });

  test("Platform.select precedence ios|android > native > default", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("ios", "android") as fc.Arbitrary<"ios" | "android">,
        fc.record({
          ios: fc.option(fc.integer(), { nil: undefined }),
          android: fc.option(fc.integer(), { nil: undefined }),
          native: fc.option(fc.integer(), { nil: undefined }),
          default: fc.option(fc.integer(), { nil: undefined }),
        }),
        (os, spec) => {
          const P = createPlatform(os);
          const got = P.select(spec);
          const expected =
            spec[os] !== undefined ? spec[os] : spec.native !== undefined ? spec.native : spec.default;
          expect(got).toBe(expected);
        },
      ),
      fcOpts,
    );
  });

  test("Dimensions reflects config.window", () => {
    fc.assert(
      fc.property(
        fc.record({
          width: fc.integer({ min: 100, max: 2000 }),
          height: fc.integer({ min: 100, max: 2000 }),
          scale: fc.integer({ min: 1, max: 4 }),
          fontScale: fc.integer({ min: 1, max: 3 }),
        }),
        (window) => {
          const D = createDimensions(window);
          expect(D.get("window")).toEqual(window);
          expect(D.get("screen")).toEqual(window);
        },
      ),
      fcOpts,
    );
  });

  test("EventEmitter add/remove/emit vs model", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.oneof(
            fc.record({ op: fc.constant("add" as const), event: fc.constantFrom("a", "b") }),
            fc.record({ op: fc.constant("emit" as const), event: fc.constantFrom("a", "b") }),
            fc.record({ op: fc.constant("clear" as const), event: fc.constantFrom("a", "b") }),
          ),
          { minLength: 1, maxLength: 20 },
        ),
        (ops) => {
          const ee = new EventEmitter();
          const counts: Record<string, number> = { a: 0, b: 0 };
          const subs: Record<string, ReturnType<typeof ee.addListener>[]> = { a: [], b: [] };

          for (const op of ops) {
            if (op.op === "add") {
              const sub = ee.addListener(op.event, () => {
                counts[op.event]!++;
              });
              subs[op.event]!.push(sub);
            } else if (op.op === "emit") {
              const before = counts[op.event]!;
              ee.emit(op.event);
              expect(counts[op.event]).toBe(before + (subs[op.event]?.length ?? 0));
            } else {
              for (const s of subs[op.event]!) s.remove();
              subs[op.event] = [];
            }
          }
        },
      ),
      fcOpts,
    );
  });

  test("PanResponder.create returns panHandlers", () => {
    const { panHandlers } = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {},
      onPanResponderMove: () => {},
      onPanResponderRelease: () => {},
    });
    expect(panHandlers.onStartShouldSetResponder).toBeTruthy();
    expect(panHandlers.onResponderGrant).toBeTruthy();
    expect(panHandlers.onResponderMove).toBeTruthy();
    expect(panHandlers.onResponderRelease).toBeTruthy();
  });

  test("PermissionsAndroid.requestMultiple grants all", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.constantFrom("CAMERA", "LOCATION", "MIC"), { minLength: 1, maxLength: 3 }),
        async (perms) => {
          const result = await PermissionsAndroid.requestMultiple(perms);
          for (const p of perms) {
            expect(result[p]).toBe(PermissionsAndroid.RESULTS.GRANTED);
          }
        },
      ),
      fcOpts,
    );
  });

  test("resolveConfig libraryMocks default is auto", () => {
    expect(resolveConfig().libraryMocks).toBe("auto");
    expect(Platform.OS === "ios" || Platform.OS === "android").toBe(true);
  });
});
