/**
 * Model-based AsyncStorage + Clipboard + NetInfo via fc.commands.
 */

import { describe, expect, test } from "bun:test";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Clipboard from "@react-native-clipboard/clipboard";
import NetInfo from "@react-native-community/netinfo";
import { createMMKV } from "react-native-mmkv";
import * as fc from "fast-check";

const opts = { numRuns: 40, endOnFailure: true as const, seed: 0x5a17e0e1 };

type StoreModel = { map: Map<string, string> };
type StoreReal = {
  /* uses module singletons */
};

class SetCmd implements fc.AsyncCommand<StoreModel, StoreReal> {
  constructor(
    readonly key: string,
    readonly value: string,
  ) {}
  check = () => true;
  async run(m: StoreModel): Promise<void> {
    m.map.set(this.key, this.value);
    await AsyncStorage.setItem(this.key, this.value);
    expect(await AsyncStorage.getItem(this.key)).toBe(this.value);
  }
  toString = () => `set(${this.key})`;
}

class RemoveCmd implements fc.AsyncCommand<StoreModel, StoreReal> {
  constructor(readonly key: string) {}
  check = () => true;
  async run(m: StoreModel): Promise<void> {
    m.map.delete(this.key);
    await AsyncStorage.removeItem(this.key);
    expect(await AsyncStorage.getItem(this.key)).toBe(m.map.get(this.key) ?? null);
  }
  toString = () => `remove(${this.key})`;
}

class ClearCmd implements fc.AsyncCommand<StoreModel, StoreReal> {
  check = () => true;
  async run(m: StoreModel): Promise<void> {
    m.map.clear();
    await AsyncStorage.clear();
    expect([...(await AsyncStorage.getAllKeys())]).toEqual([]);
  }
  toString = () => "clear";
}

class AssertKeysCmd implements fc.AsyncCommand<StoreModel, StoreReal> {
  check = () => true;
  async run(m: StoreModel): Promise<void> {
    const keys = await AsyncStorage.getAllKeys();
    expect([...keys].sort()).toEqual([...m.map.keys()].sort());
    for (const [k, v] of m.map) {
      expect(await AsyncStorage.getItem(k)).toBe(v);
    }
  }
  toString = () => "assertKeys";
}

describe("commands: async-storage", () => {
  test("set/remove/clear vs Map model", async () => {
    const key = fc.stringMatching(/^[a-z]{1,4}$/);
    const val = fc.stringMatching(/^[A-Za-z0-9]{0,8}$/);
    const cmds = [
      fc.tuple(key, val).map(([k, v]) => new SetCmd(k, v)),
      key.map((k) => new RemoveCmd(k)),
      fc.constant(new ClearCmd()),
      fc.constant(new AssertKeysCmd()),
    ];
    await fc.assert(
      fc.asyncProperty(fc.commands(cmds, { maxCommands: 20 }), async (commands) => {
        await AsyncStorage.clear();
        await fc.asyncModelRun(() => ({ model: { map: new Map<string, string>() }, real: {} }), commands);
      }),
      opts,
    );
  });
});

type ClipModel = { value: string };
class ClipSet implements fc.AsyncCommand<ClipModel, Record<string, never>> {
  constructor(readonly value: string) {}
  check = () => true;
  async run(m: ClipModel): Promise<void> {
    m.value = this.value;
    await Clipboard.setString(this.value);
    expect(await Clipboard.getString()).toBe(m.value);
  }
  toString = () => `clip(${JSON.stringify(this.value)})`;
}

describe("commands: clipboard", () => {
  test("set/get round-trip", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.commands([fc.stringMatching(/^[A-Za-z0-9 ]{0,12}$/).map((v) => new ClipSet(v))], { maxCommands: 12 }),
        async (commands) => {
          await Clipboard.setString("");
          await fc.asyncModelRun(() => ({ model: { value: "" }, real: {} }), commands);
        },
      ),
      opts,
    );
  });
});

describe("commands: netinfo + mmkv", () => {
  test("netinfo fetch is stable shape", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 5 }), async (n) => {
        for (let i = 0; i < n; i++) {
          const s = await NetInfo.fetch();
          expect(typeof s.type).toBe("string");
          expect(typeof s.isConnected).toBe("boolean");
        }
      }),
      { numRuns: 20 },
    );
  });

  test("mmkv set/get/remove vs Map", () => {
    type M = { map: Map<string, string> };
    class SetM implements fc.Command<M, { storage: ReturnType<typeof createMMKV> }> {
      constructor(
        readonly k: string,
        readonly v: string,
      ) {}
      check = () => true;
      run(m: M, r: { storage: ReturnType<typeof createMMKV> }): void {
        m.map.set(this.k, this.v);
        (r.storage as { set: (k: string, v: string) => void }).set(this.k, this.v);
        expect((r.storage as { getString: (k: string) => string | undefined }).getString(this.k)).toBe(this.v);
      }
      toString = () => `mmkvSet(${this.k})`;
    }
    class DelM implements fc.Command<M, { storage: ReturnType<typeof createMMKV> }> {
      constructor(readonly k: string) {}
      check = () => true;
      run(m: M, r: { storage: ReturnType<typeof createMMKV> }): void {
        m.map.delete(this.k);
        (r.storage as { remove: (k: string) => void }).remove(this.k);
        expect((r.storage as { getString: (k: string) => string | undefined }).getString(this.k)).toBe(
          m.map.get(this.k),
        );
      }
      toString = () => `mmkvDel(${this.k})`;
    }
    const key = fc.stringMatching(/^[a-z]{1,4}$/);
    const val = fc.stringMatching(/^[A-Za-z0-9]{0,8}$/);
    fc.assert(
      fc.property(
        fc.commands([fc.tuple(key, val).map(([k, v]) => new SetM(k, v)), key.map((k) => new DelM(k))], {
          maxCommands: 16,
        }),
        (commands) => {
          const id = `mmkv-cmd-${Math.random()}`;
          const storage = createMMKV({ id } as never);
          fc.modelRun(() => ({ model: { map: new Map<string, string>() }, real: { storage } }), commands);
        },
      ),
      opts,
    );
  });
});
