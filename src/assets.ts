/**
 * Asset stub loader — pure functions.
 *
 * Asset imports (`.png`, `.jpg`, …) become modules whose default export
 * mirrors Metro/Jest's `{ uri, testUri, width, height, scale }` shape.
 */

export function isAssetPath(filePath: string, assetExts: readonly string[]): boolean {
  const lower = filePath.toLowerCase();
  const dot = lower.lastIndexOf(".");
  if (dot < 0) return false;
  const ext = lower.slice(dot + 1);
  return assetExts.includes(ext);
}

export type AssetModule = {
  uri: string;
  testUri: string;
  width: number;
  height: number;
  scale: number;
};

/**
 * Generate ESM source for an asset stub module.
 * The default export round-trips the exact source path in `uri` / `testUri`.
 */
export function assetModuleSource(filePath: string): string {
  const payload: AssetModule = {
    uri: filePath,
    testUri: filePath,
    width: 1,
    height: 1,
    scale: 1,
  };
  return `export default ${JSON.stringify(payload)};\n`;
}
