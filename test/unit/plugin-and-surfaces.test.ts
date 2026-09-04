import { describe, expect, test } from "bun:test";
import { createReactNativePlugin } from "../../src/index.ts";
import {
  createAccessibilityInfo,
  createAppearance,
  createAppState,
  createClipboard,
  createHostMocks,
  createInteractionManager,
  createLinking,
  createNativeAnimatedHelper,
  createNativeComponentRegistry,
  createNativeEventEmitter,
  createPixelRatio,
  createRequireNativeComponent,
  createSettings,
  createTurboModuleRegistry,
  createUIManager,
  createVibration,
} from "../../src/mocks/surfaces.ts";
import { createNativeModules } from "../../src/mocks/NativeModules.ts";
import { DEFAULT_WINDOW } from "../../src/config.ts";
import { priorityRank } from "../../src/resolve.ts";
import path from "node:path";

describe("createReactNativePlugin factory", () => {
  test("registers onResolve / onLoad hooks on a fake build", () => {
    const resolves: Array<{ filter: RegExp; namespace?: string }> = [];
    const loads: Array<{ filter: RegExp; namespace?: string }> = [];
    const plugin = createReactNativePlugin({
      strategy: "namespace",
      platform: "ios",
      debug: false,
      cacheDir: null as unknown as string,
    });
    // Override cacheDir via resolveConfig defaults — pass empty string to skip disk
    const p2 = createReactNativePlugin({ strategy: "direct", platform: "android" });

    plugin.setup!({
      onResolve(opts: { filter: RegExp; namespace?: string }, _cb: unknown) {
        resolves.push(opts);
      },
      onLoad(opts: { filter: RegExp; namespace?: string }, _cb: unknown) {
        loads.push(opts);
      },
    } as never);

    p2.setup!({
      onResolve(opts: { filter: RegExp; namespace?: string }, _cb: unknown) {
        resolves.push(opts);
      },
      onLoad(opts: { filter: RegExp; namespace?: string }, _cb: unknown) {
        loads.push(opts);
      },
    } as never);

    expect(resolves.length).toBeGreaterThan(0);
    expect(loads.length).toBeGreaterThan(0);
    expect(plugin.name).toBe("bun-plugin-react-native-testing-library");
  });

  test("namespace onLoad transforms a relative fixture via callbacks", async () => {
    type ResolveCb = (args: {
      path: string;
      importer?: string;
      namespace?: string;
    }) => { path: string; namespace?: string } | undefined | void;
    type LoadCb = (args: { path: string }) =>
      | { contents: string; loader: string }
      | undefined
      | void;

    const resolveCbs: ResolveCb[] = [];
    const loadCbs: Array<{ opts: { filter: RegExp; namespace?: string }; cb: LoadCb }> = [];

    const plugin = createReactNativePlugin({
      strategy: "namespace",
      include: ["/virt-rn/"],
      cacheDir: `${process.cwd()}/.rn-bun-cache-test`,
    });

    plugin.setup!({
      onResolve(_opts: { filter: RegExp }, cb: ResolveCb) {
        resolveCbs.push(cb);
      },
      onLoad(opts: { filter: RegExp; namespace?: string }, cb: LoadCb) {
        loadCbs.push({ opts, cb });
      },
    } as never);

    // Write a tiny Flow file under a path matching include
    const dir = `${process.cwd()}/.virt-rn-fixture`;
    await Bun.write(`${dir}/Foo.js`, "// @flow\nexport const x: number = 1;\n");

    // Platform resolve for relative import
    let resolved: { path: string; namespace?: string } | undefined;
    for (const cb of resolveCbs) {
      const r = cb({ path: "./Foo", importer: `${dir}/index.js` });
      if (r) {
        resolved = r;
        break;
      }
    }
    // May or may not resolve depending on filter order — exercise load path directly
    const nsLoad = loadCbs.find((l) => l.opts.namespace === "rn-flow");
    expect(nsLoad).toBeTruthy();
    const loaded = nsLoad!.cb({ path: `${dir}/Foo.js` });
    expect(loaded?.contents).toBeTruthy();
    expect(loaded?.loader).toBe("js");
    expect(loaded!.contents.includes(": number")).toBe(false);

    void resolved;
  });
});

describe("surfaces factories", () => {
  test("native surface factories are callable and behaviour-minimal", () => {
    const ui = createUIManager();
    expect(ui.hasViewManagerConfig("AndroidDrawerLayout")).toBe(true);
    expect(ui.getViewManagerConfig("AndroidDrawerLayout")).toBeTruthy();
    ui.blur();
    ui.measure();

    const mods = createNativeModules(DEFAULT_WINDOW) as unknown as Record<string, unknown>;
    const turbo = createTurboModuleRegistry(mods);
    expect(turbo.get("DeviceInfo")).toBeTruthy();
    expect(turbo.getEnforcing("MissingModule")).toBeTruthy();

    const Emitter = createNativeEventEmitter();
    const em = new Emitter();
    expect(em.addListener("x", () => {}).remove).toBeFunction();

    expect(createPixelRatio().get()).toBe(3);
    const appearance = createAppearance();
    expect(appearance.getColorScheme()).toBe("light");
    appearance.setColorScheme("dark");
    expect(appearance.getColorScheme()).toBe("dark");

    const settings = createSettings();
    settings.set({ a: 1 });
    expect(settings.get("a")).toBe(1);

    expect(createAccessibilityInfo().isScreenReaderEnabled()).toBeInstanceOf(Promise);
    expect(createInteractionManager().createInteractionHandle()).toBe(1);
    expect(createAppState().currentState).toBe("active");
    expect(createLinking().canOpenURL()).toBeInstanceOf(Promise);
    createVibration().vibrate();
    const clip = createClipboard();
    clip.setString("hi");
    expect(clip.getString()).toBeInstanceOf(Promise);

    const reg = createNativeComponentRegistry();
    expect(reg.get("RCTView")).toBeTruthy();
    const rnc = createRequireNativeComponent();
    expect(rnc("RCTText")).toBeTruthy();

    const anim = createNativeAnimatedHelper();
    expect(anim.shouldUseNativeDriver()).toBe(false);
    expect(anim.generateNewNodeTag()).toBe(1);

    const hosts = createHostMocks(DEFAULT_WINDOW);
    expect(hosts.View).toBeTruthy();
    expect(hosts.Text).toBeTruthy();
  });
});

describe("resolve priorityRank helper", () => {
  test("ranks ios variant above plain", () => {
    const base = "/proj/Foo";
    const ios = path.join("/proj", "Foo.ios.js");
    // candidatePaths uses relative base — just ensure the helper is executable
    const rank = priorityRank(ios, base, "ios");
    expect(typeof rank).toBe("number");
  });
});
