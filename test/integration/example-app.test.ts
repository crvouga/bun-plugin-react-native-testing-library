/**
 * Integration: spawn `bun test` against the example app with/without preload.
 *
 * Uses a persistent install cache under `.virt-rn-fixture/example-sandbox` so
 * each run does not pay for a fresh `bun install` (~3–15s).
 */

import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { Pressable, Text, View } from "react-native";
import { render } from "@testing-library/react-native";
import { existsSync, mkdirSync, rmSync, writeFileSync, cpSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dir, "../..");
const CACHE = path.join(ROOT, ".virt-rn-fixture", "example-sandbox");

async function runBunTest(
  cwd: string,
  args: string[] = ["example-app"],
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const proc = Bun.spawn({
    cmd: [process.execPath, "test", "--bail", ...args],
    cwd,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,
      FORCE_COLOR: "0",
    },
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { exitCode, stdout, stderr };
}

function packageJson(): string {
  return JSON.stringify(
    {
      name: "example-sandbox",
      type: "module",
      private: true,
      dependencies: {
        "bun-plugin-react-native-testing-library": `file:${ROOT}`,
        react: "19.2.8",
        "react-native": "0.87.1",
        "@testing-library/react-native": "14.0.1",
        "test-renderer": "1.2.0",
      },
    },
    null,
    2,
  );
}

async function ensureCachedInstall(): Promise<void> {
  mkdirSync(CACHE, { recursive: true });
  const pkgPath = path.join(CACHE, "package.json");
  const next = packageJson();
  const prev = existsSync(pkgPath) ? readFileSync(pkgPath, "utf8") : "";
  writeFileSync(pkgPath, next);

  const needsInstall = !existsSync(path.join(CACHE, "node_modules")) || prev !== next;
  if (!needsInstall) return;

  const install = Bun.spawn({
    cmd: [process.execPath, "install"],
    cwd: CACHE,
    stdout: "pipe",
    stderr: "pipe",
  });
  const code = await install.exited;
  if (code !== 0) {
    const err = await new Response(install.stderr).text();
    throw new Error(`example-sandbox install failed: ${err}`);
  }
}

function syncExampleApp(): void {
  const dest = path.join(CACHE, "example-app");
  rmSync(dest, { recursive: true, force: true });
  cpSync(path.join(ROOT, "test", "example-app"), dest, { recursive: true });
}

function writeBunfig(withPreload: boolean): void {
  writeFileSync(
    path.join(CACHE, "bunfig.toml"),
    withPreload ? `[test]\npreload = ["bun-plugin-react-native-testing-library/preload"]\n` : `[test]\n`,
  );
}

describe("integration: example-app under bun test", () => {
  test("with preload: suite passes", async () => {
    await ensureCachedInstall();
    syncExampleApp();
    writeBunfig(true);

    const { exitCode, stdout, stderr } = await runBunTest(CACHE);
    const out = `${stdout}${stderr}`;
    if (exitCode !== 0) console.error(out.slice(-1200));
    expect(exitCode).toBe(0);
    expect(out).toMatch(/\d+ pass/);
    expect(out).toMatch(/0 fail/);
  }, 60_000);

  test("without preload: suite fails (negative control)", async () => {
    await ensureCachedInstall();
    syncExampleApp();
    writeBunfig(false);

    const { exitCode } = await runBunTest(CACHE);
    expect(exitCode).not.toBe(0);
  }, 60_000);
});

describe("integration: RNTL matcher smoke", () => {
  test("toBeOnTheScreen, toHaveTextContent, toBeVisible, getByRole", async () => {
    const screen = await render(
      createElement(
        View,
        { testID: "wrap" },
        createElement(Text, { testID: "label" }, "hello"),
        createElement(
          Pressable,
          {
            testID: "btn",
            accessibilityRole: "button",
            accessibilityLabel: "go",
            accessible: true,
          },
          createElement(Text, null, "Go"),
        ),
      ),
    );

    expect(screen.getByTestId("label")).toBeOnTheScreen();
    expect(screen.getByTestId("label")).toBeVisible();
    expect(screen.getByTestId("label")).toHaveTextContent("hello");
    expect(screen.getByLabelText("go")).toBeOnTheScreen();
    const button = screen.queryByRole("button") ?? screen.getByTestId("btn");
    expect(button).toBeOnTheScreen();
    expect(button).toBeVisible();
  });
});
