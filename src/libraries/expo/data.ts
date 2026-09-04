/**
 * Expo data shims: sqlite via bun:sqlite, in-memory file-system (opportunistic).
 */

import type { LibraryShim } from "../helpers.ts";
import { mockBoth, packageResolves } from "../helpers.ts";
import { asyncNoop, noop } from "../../mocks/host.ts";

export const expoDataShim: LibraryShim = {
  name: "expo-data",
  packages: ["expo-modules-core"],
  register({ cwd }) {
    const maybe = (spec: string, factory: () => unknown) => {
      if (packageResolves(spec, cwd)) mockBoth(spec, factory, cwd);
    };

    maybe("expo-sqlite", () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { Database } = require("bun:sqlite") as {
        Database: new (
          name?: string,
        ) => {
          close: () => void;
          run: (sql: string, ...params: unknown[]) => unknown;
          query: (sql: string) => { all: (...params: unknown[]) => unknown[]; get: (...params: unknown[]) => unknown };
          exec: (sql: string) => void;
        };
      };

      const openDatabaseSync = (name: string) => {
        const db = new Database(`:memory:${name}`);
        return {
          execSync: (sql: string) => db.exec(sql),
          runSync: (sql: string, ...params: unknown[]) => db.run(sql, ...params),
          getAllSync: (sql: string, ...params: unknown[]) => db.query(sql).all(...params),
          getFirstSync: (sql: string, ...params: unknown[]) => db.query(sql).get(...params) ?? null,
          closeSync: () => db.close(),
          withTransactionSync: (fn: () => void) => {
            db.exec("BEGIN");
            try {
              fn();
              db.exec("COMMIT");
            } catch (e) {
              db.exec("ROLLBACK");
              throw e;
            }
          },
        };
      };

      return {
        openDatabaseSync,
        openDatabaseAsync: async (name: string) => openDatabaseSync(name),
        deleteDatabaseSync: noop,
        deleteDatabaseAsync: asyncNoop,
      };
    });

    const vfs = new Map<string, string | Uint8Array>();
    maybe("expo-file-system", () => {
      const documentDirectory = "file:///document/";
      const cacheDirectory = "file:///cache/";

      class File {
        uri: string;
        constructor(...parts: string[]) {
          this.uri = parts.join("/").replace(/\/+/g, "/");
        }
        get exists() {
          return vfs.has(this.uri);
        }
        text() {
          const v = vfs.get(this.uri);
          return typeof v === "string" ? v : v ? new TextDecoder().decode(v) : "";
        }
        write(content: string | Uint8Array) {
          vfs.set(this.uri, content);
        }
        delete() {
          vfs.delete(this.uri);
        }
        create() {
          if (!vfs.has(this.uri)) vfs.set(this.uri, "");
        }
      }

      class Directory {
        uri: string;
        constructor(...parts: string[]) {
          this.uri = parts.join("/").replace(/\/+/g, "/");
          if (!this.uri.endsWith("/")) this.uri += "/";
        }
        get exists() {
          return [...vfs.keys()].some((k) => k.startsWith(this.uri));
        }
        create() {
          vfs.set(this.uri, "");
        }
        delete() {
          for (const k of [...vfs.keys()]) if (k.startsWith(this.uri)) vfs.delete(k);
        }
        list() {
          return [...vfs.keys()].filter((k) => k.startsWith(this.uri));
        }
      }

      return {
        File,
        Directory,
        Paths: { document: documentDirectory, cache: cacheDirectory },
        documentDirectory,
        cacheDirectory,
        bundleDirectory: "file:///bundle/",
        writeAsStringAsync: async (uri: string, contents: string) => {
          vfs.set(uri, contents);
        },
        readAsStringAsync: async (uri: string) => {
          const v = vfs.get(uri);
          if (v == null) throw new Error(`File not found: ${uri}`);
          return typeof v === "string" ? v : new TextDecoder().decode(v);
        },
        deleteAsync: async (uri: string) => {
          vfs.delete(uri);
        },
        getInfoAsync: async (uri: string) => ({
          exists: vfs.has(uri),
          uri,
          size: vfs.get(uri)?.length ?? 0,
          isDirectory: uri.endsWith("/"),
        }),
        makeDirectoryAsync: async (uri: string) => {
          vfs.set(uri.endsWith("/") ? uri : `${uri}/`, "");
        },
        readDirectoryAsync: async (uri: string) =>
          [...vfs.keys()].filter((k) => k.startsWith(uri)).map((k) => k.slice(uri.length)),
        copyAsync: async ({ from, to }: { from: string; to: string }) => {
          const v = vfs.get(from);
          if (v != null) vfs.set(to, v);
        },
        moveAsync: async ({ from, to }: { from: string; to: string }) => {
          const v = vfs.get(from);
          if (v != null) {
            vfs.set(to, v);
            vfs.delete(from);
          }
        },
        downloadAsync: async (url: string, uri: string) => {
          vfs.set(uri, `downloaded:${url}`);
          return { uri, status: 200, headers: {}, md5: "md5" };
        },
        __vfs: vfs,
      };
    });

    maybe("expo-file-system/legacy", () => ({
      downloadAsync: async () => ({ md5: "md5", uri: "uri" }),
      getInfoAsync: async () => ({ exists: true, md5: "md5", uri: "uri" }),
      readAsStringAsync: async () => "",
      writeAsStringAsync: asyncNoop,
      deleteAsync: asyncNoop,
      moveAsync: asyncNoop,
      copyAsync: asyncNoop,
      makeDirectoryAsync: asyncNoop,
      readDirectoryAsync: async () => [],
      createDownloadResumable: () => ({ downloadAsync: async () => ({ uri: "uri" }) }),
    }));
  },
};
