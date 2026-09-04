import { describe, expect, test } from "bun:test";
import { assetModuleSource, isAssetPath, type AssetModule } from "../../src/assets.ts";
import { DEFAULT_ASSET_EXTS } from "../../src/config.ts";

describe("assets.ts", () => {
  test("isAssetPath recognises configured extensions (case-insensitive)", () => {
    expect(isAssetPath("/a/b/icon.PNG", DEFAULT_ASSET_EXTS)).toBe(true);
    expect(isAssetPath("/a/b/photo.jpeg", DEFAULT_ASSET_EXTS)).toBe(true);
    expect(isAssetPath("/a/b/font.ttf", DEFAULT_ASSET_EXTS)).toBe(true);
    expect(isAssetPath("/a/b/clip.mp4", DEFAULT_ASSET_EXTS)).toBe(true);
    expect(isAssetPath("/a/b/app.ts", DEFAULT_ASSET_EXTS)).toBe(false);
    expect(isAssetPath("/a/b/noext", DEFAULT_ASSET_EXTS)).toBe(false);
  });

  test("assetModuleSource embeds the exact path and parses as JS", () => {
    const p = "/Users/me/app/assets/logo.png";
    const src = assetModuleSource(p);
    const transpiled = new Bun.Transpiler({ loader: "js" }).transformSync(src);
    expect(typeof transpiled).toBe("string");

    // Evaluate the ESM-ish default export via Function + synthetic module pattern.
    const match = src.match(/export default ({.*});/);
    expect(match).toBeTruthy();
    const mod = JSON.parse(match![1]!) as AssetModule;
    expect(mod.uri).toBe(p);
    expect(mod.testUri).toBe(p);
    expect(mod.width).toBe(1);
    expect(mod.height).toBe(1);
    expect(mod.scale).toBe(1);
  });

  test("each default asset extension yields a module with the source path", () => {
    for (const ext of DEFAULT_ASSET_EXTS) {
      const p = `/x/y/file.${ext}`;
      const src = assetModuleSource(p);
      const match = src.match(/export default ({.*});/);
      expect(match).toBeTruthy();
      const mod = JSON.parse(match![1]!) as AssetModule;
      expect(mod.uri).toBe(p);
    }
  });
});
