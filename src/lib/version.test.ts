import { $ } from "bun";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import process from "node:process";
import { join } from "path";

import {
  bumpVersion,
  commitBump,
  highestBump,
  highestVersion,
  resolveNextVersion,
} from "./version";

describe("commitBump", () => {
  test.each([
    ["feat(ecs): add queries", "minor"],
    ["fix: crash on start", "patch"],
    ["perf(core): faster loop", "patch"],
    ["feat!: drop node 22", "major"],
    ["refactor(core)!: rename world", "major"],
    ["fix: thing\n\nBREAKING CHANGE: the api changed", "major"],
    ["feat: x\n\nBREAKING-CHANGE: y", "major"],
    ["chore(deps): bump", undefined],
    ["docs: typo", undefined],
    ["not conventional", undefined],
  ])("%p → %p", (message, bump) => expect(commitBump(message)).toBe(bump as never));
});

test("highestBump keeps the biggest bump", () => {
  expect(highestBump(["fix: a", "feat: b", "chore: c"])).toBe("minor");
  expect(highestBump(["fix: a", "feat!: b"])).toBe("major");
  expect(highestBump(["chore: a"])).toBeUndefined();
});

test("bumpVersion follows semver", () => {
  expect(bumpVersion("1.2.3", "major")).toBe("2.0.0");
  expect(bumpVersion("1.2.3", "minor")).toBe("1.3.0");
  expect(bumpVersion("1.2.3", "patch")).toBe("1.2.4");
  expect(() => bumpVersion("nope", "patch")).toThrow();
});

test("highestVersion compares as semver", () => {
  expect(highestVersion(["1.9.0", "1.10.0", "1.2.0"])).toBe("1.10.0");
});

describe("resolveNextVersion (real git repo)", () => {
  const cwd = process.cwd();
  let dir = "";
  const commit = async (file: string, message: string) => {
    mkdirSync(join(dir, file, ".."), { recursive: true });
    writeFileSync(join(dir, file), message);
    await $`git add -A && git -c user.name=t -c user.email=t@t commit -qm ${message}`;
  };

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), "nf-version-"));
    process.chdir(dir);
    await $`git init -q -b main`;
    await commit("packages/a/x", "feat(a): first");
    await $`git tag 1.0.0`;
    await commit("packages/a/y", "fix(a): bug");
    await commit("packages/b/y", "feat(b)!: break b");
  });

  afterAll(() => {
    process.chdir(cwd);
    rmSync(dir, { recursive: true, force: true });
  });

  test("bumps from the commits after the tag, limited to the paths", async () => {
    const tag = { format: "{version}", name: "g" };
    expect((await resolveNextVersion("1.0.0", tag, ["packages/a"])).version).toBe("1.0.1");
    expect((await resolveNextVersion("1.0.0", tag, ["packages/a", "packages/b"])).version).toBe(
      "2.0.0",
    );
  });

  test("uses the whole history when the tag is missing", async () => {
    const result = await resolveNextVersion(
      "1.0.0",
      { format: "{package}@{version}", name: "g", package: "a" },
      ["packages/a"],
    );
    expect(result).toEqual({ version: "1.1.0", bump: "minor", since: undefined });
  });

  test("fails when nothing asks for a release", async () => {
    await commit("packages/c/z", "chore(c): nothing");
    await $`git tag c-1.0.0`;
    await expect(
      resolveNextVersion("1.0.0", { format: "c-{version}", name: "c" }, ["packages/c"]),
    ).rejects.toThrow(/give a version/);
  });
});
