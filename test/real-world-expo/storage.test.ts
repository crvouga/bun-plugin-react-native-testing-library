import { describe, expect, test } from "bun:test";
import * as fc from "fast-check";
import * as SecureStore from "expo-secure-store";
import * as Clipboard from "expo-clipboard";
import * as FileSystem from "expo-file-system";
import * as SQLite from "expo-sqlite";

const opts = { numRuns: 20, endOnFailure: true as const };
const key = fc.stringMatching(/^[A-Za-z][A-Za-z0-9]{0,8}$/);
const val = fc.stringMatching(/^[A-Za-z0-9 ]{0,16}$/);

describe("expo storage property", () => {
  test("secure-store set/get/delete vs Map model", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.tuple(key, val, fc.constantFrom("set", "get", "del")), { minLength: 1, maxLength: 12 }),
        async (ops) => {
          const model = new Map<string, string>();
          for (const [k, v, op] of ops) {
            if (op === "set") {
              await SecureStore.setItemAsync(k, v);
              model.set(k, v);
            } else if (op === "del") {
              await SecureStore.deleteItemAsync(k);
              model.delete(k);
            } else {
              expect(await SecureStore.getItemAsync(k)).toBe(model.get(k) ?? null);
            }
          }
        },
      ),
      opts,
    );
  });

  test("clipboard set/get round-trip", async () => {
    await fc.assert(
      fc.asyncProperty(val, async (v) => {
        await Clipboard.setStringAsync(v);
        expect(await Clipboard.getStringAsync()).toBe(v);
      }),
      opts,
    );
  });

  test("file-system write/read vs VFS", async () => {
    await fc.assert(
      fc.asyncProperty(key, val, async (name, contents) => {
        const uri = `file:///document/${name}.txt`;
        await FileSystem.writeAsStringAsync(uri, contents);
        expect(await FileSystem.readAsStringAsync(uri)).toBe(contents);
        const info = await FileSystem.getInfoAsync(uri);
        expect(info.exists).toBe(true);
        await FileSystem.deleteAsync(uri);
      }),
      opts,
    );
  });

  test("sqlite exec/query vs bun memory db", () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 1, max: 100 }), { minLength: 1, maxLength: 8 }), (nums) => {
        const db = SQLite.openDatabaseSync(`t-${nums.join("-")}`);
        db.execSync("CREATE TABLE t (id INTEGER PRIMARY KEY, n INTEGER);");
        for (const n of nums) db.runSync("INSERT INTO t (n) VALUES (?);", n);
        const rows = db.getAllSync("SELECT n FROM t ORDER BY id;") as Array<{ n: number }>;
        expect(rows.map((r) => r.n)).toEqual(nums);
        db.closeSync();
      }),
      opts,
    );
  });
});
