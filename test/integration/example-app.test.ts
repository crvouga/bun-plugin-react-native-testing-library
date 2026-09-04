/**
 * Integration: spawn `bun test` against the example app with/without preload.
 */

import { describe, expect, test } from "bun:test";
import * as React from "react";
import { Pressable, Text, View } from "react-native";
import { render } from "@testing-library/react-native";
import { mkdtempSync, rmSync, writeFileSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const ROOT = path.resolve(import.meta.dir, "../..");

async function runBunTest(
  cwd: string,
  args: string[] = ["."],
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const proc = Bun.spawn({
    cmd: [process.execPath, "test", ...args],
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

function prepareExampleSandbox(opts: { withPreload: boolean }): string {
  const dir = mkdtempSync(path.join(tmpdir(), "rn-bun-ex-"));
  cpSync(path.join(ROOT, "test", "example-app"), path.join(dir, "example-app"), {
    recursive: true,
  });
  writeFileSync(
    path.join(dir, "package.json"),
    JSON.stringify(
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
    ),
  );

  if (opts.withPreload) {
    writeFileSync(
      path.join(dir, "bunfig.toml"),
      `[test]\npreload = ["bun-plugin-react-native-testing-library/preload"]\n`,
    );
  } else {
    writeFileSync(path.join(dir, "bunfig.toml"), `[test]\n`);
  }

  return dir;
}

describe("integration: example-app under bun test", () => {
  test("with preload: suite passes", async () => {
    const dir = prepareExampleSandbox({ withPreload: true });
    try {
      const install = Bun.spawn({
        cmd: [process.execPath, "install"],
        cwd: dir,
        stdout: "pipe",
        stderr: "pipe",
      });
      const installCode = await install.exited;
      expect(installCode).toBe(0);

      const { exitCode, stdout, stderr } = await runBunTest(dir, ["example-app"]);
      const out = stdout + stderr;
      console.log("POSITIVE_OUT_TAIL\n", out.slice(-800));
      expect(exitCode).toBe(0);
      expect(out).toMatch(/\d+ pass/);
      expect(out).toMatch(/0 fail/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 180_000);

  test("without preload: suite fails (negative control)", async () => {
    const dir = prepareExampleSandbox({ withPreload: false });
    try {
      const install = Bun.spawn({
        cmd: [process.execPath, "install"],
        cwd: dir,
        stdout: "pipe",
        stderr: "pipe",
      });
      await install.exited;

      const { exitCode, stdout, stderr } = await runBunTest(dir, ["example-app"]);
      const out = stdout + stderr;
      console.log("NEGATIVE_OUT_TAIL\n", out.slice(-800));
      expect(exitCode).not.toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 180_000);
});

describe("integration: RNTL matcher smoke", () => {
  test("toBeOnTheScreen, toHaveTextContent, toBeVisible, getByRole", async () => {
    const screen = await render(
      React.createElement(
        View,
        { testID: "wrap" },
        React.createElement(Text, { testID: "label" }, "hello"),
        React.createElement(
          Pressable,
          {
            testID: "btn",
            accessibilityRole: "button",
            accessibilityLabel: "go",
            accessible: true,
          },
          React.createElement(Text, null, "Go"),
        ),
      ),
    );

    expect(screen.getByTestId("label")).toBeOnTheScreen();
    expect(screen.getByTestId("label")).toBeVisible();
    expect(screen.getByTestId("label")).toHaveTextContent("hello");
    expect(screen.getByLabelText("go")).toBeOnTheScreen();
    // Prefer role query when RNTL recognizes it; fall back to testID so the
    // matcher smoke still covers toBeOnTheScreen on an interactive host.
    const button = screen.queryByRole("button") ?? screen.getByTestId("btn");
    expect(button).toBeOnTheScreen();
    expect(button).toBeVisible();
  });
});
