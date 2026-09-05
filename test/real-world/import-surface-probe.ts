/**
 * Spawned by import-surface.test.ts inside test/real-world.
 * Exits 0 when every installed catalog package loads with expected exports.
 */

import { resolveConfig } from "../../src/config.ts";
import { registerLibraryMocks } from "../../src/libraries/index.ts";
import { registerMocks } from "../../src/mocks/index.ts";
import { REAL_WORLD_CATALOG } from "../contract/scan/catalog.ts";
import { getExport, isEmptyModule } from "../contract/scan/scanner.ts";

// Preload already registered mocks; re-bind for this cwd.
const config = resolveConfig({ libraryMocks: "auto", debug: false });
registerMocks(config);
const { activated } = registerLibraryMocks(config);

const installed = REAL_WORLD_CATALOG.filter((e) => {
  try {
    Bun.resolveSync(e.name, process.cwd());
    return true;
  } catch {
    return false;
  }
});

const errors: string[] = [];

for (const entry of installed) {
  if (entry.shim && !activated.includes(entry.shim)) {
    errors.push(`${entry.name}: shim "${entry.shim}" not activated (got [${activated.join(",")}])`);
    continue;
  }
  let mod: unknown;
  try {
    const abs = Bun.resolveSync(entry.name, process.cwd());
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require(abs);
  } catch (err) {
    errors.push(`${entry.name}: ${err instanceof Error ? err.message : String(err)}`);
    continue;
  }
  if (!entry.sideEffect && isEmptyModule(mod)) {
    errors.push(`${entry.name}: empty Module {}`);
    continue;
  }
  for (const exp of entry.exports ?? []) {
    if (getExport(mod, exp) === undefined) {
      errors.push(`${entry.name}: missing export ${exp} (keys=${Object.keys((mod as object) ?? {}).slice(0, 16)})`);
    }
  }
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`import-surface ok: ${installed.length} packages`);
