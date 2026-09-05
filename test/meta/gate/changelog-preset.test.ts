/**
 * Fail-closed: the conventionalcommits preset must render against the writer
 * that @semantic-release/release-notes-generator actually loads.
 *
 * conventional-changelog-conventionalcommits@10 + writer@8 crashes generateNotes
 * (semantic-release/release-notes-generator#1027). Pin stays at 9.3.1 until
 * release-notes-generator 15 (writer@9) is stable.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { generateNotes } from "@semantic-release/release-notes-generator";

const ROOT = join(import.meta.dir, "../../..");

describe("meta: semantic-release changelog preset", () => {
  test("package.json pins writer@8-compatible conventionalcommits 9.3.1", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
      devDependencies: Record<string, string>;
    };
    expect(pkg.devDependencies["conventional-changelog-conventionalcommits"]).toBe("9.3.1");
  });

  test("generateNotes renders a conventionalcommits body", async () => {
    const logger = { log() {}, error() {}, success() {}, warn() {}, info() {} };
    const notes = await generateNotes(
      { preset: "conventionalcommits" },
      {
        cwd: ROOT,
        env: process.env,
        stdout: process.stdout,
        stderr: process.stderr,
        logger,
        commits: [
          {
            hash: "deadbeef",
            message: "fix: pin changelog preset",
            gitTags: "",
            commit: { long: "deadbeef", short: "deadbee" },
            committer: { name: "t", email: "t@t", date: new Date().toISOString() },
            author: { name: "t", email: "t@t", date: new Date().toISOString() },
            committerDate: new Date().toISOString(),
            body: "",
            footer: "",
            subject: "pin changelog preset",
            type: "fix",
            scope: null,
            notes: [],
            references: [],
            mentions: [],
            revert: null,
            header: "fix: pin changelog preset",
          },
        ],
        lastRelease: { version: "0.1.0", gitTag: "v0.1.0", gitHead: "abc", channels: [null] },
        nextRelease: {
          type: "patch",
          version: "0.1.1",
          gitTag: "v0.1.1",
          gitHead: "def",
          name: "v0.1.1",
          notes: "",
          channel: null,
        },
        options: {
          repositoryUrl: "https://github.com/crvouga/bun-plugin-react-native-testing-library.git",
          tagFormat: `v\${version}`,
        },
        branch: { name: "main" },
        branches: [{ name: "main" }],
      },
    );
    expect(notes).toContain("### Bug Fixes");
    expect(notes).toContain("0.1.1");
  });
});
