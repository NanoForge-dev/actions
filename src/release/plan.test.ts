import { $ } from "bun";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import process from "node:process";
import { join } from "path";

import { type ReleaseGroup } from "../lib/config";
import { type WorkspacePackage } from "../lib/workspace";
import { findReleased, planTags } from "./plan";

const group = (overrides: Partial<ReleaseGroup> = {}): ReleaseGroup => ({
  name: "grp",
  packages: [],
  mode: "all",
  versioning: "shared",
  npm: true,
  githubRelease: true,
  latest: true,
  tagFormat: "{name}@{version}",
  branchFormat: "{name}-release",
  commitFormat: "chore: release {name}@{version}",
  majorTag: false,
  betaOnMerge: false,
  ...overrides,
});

const pkg = (dir: string, name: string, version: string): WorkspacePackage => ({
  name,
  version,
  path: join(dir, "packages", name),
  private: false,
  dependsOn: [],
});

const writePkg = (dir: string, name: string, version: string, changelog?: string) => {
  const path = join(dir, "packages", name);
  mkdirSync(path, { recursive: true });
  writeFileSync(join(path, "package.json"), JSON.stringify({ name, version }));
  if (changelog) writeFileSync(join(path, "CHANGELOG.md"), changelog);
};

describe("findReleased (real git repo)", () => {
  const cwd = process.cwd();
  let dir = "";

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), "nf-release-plan-"));
    process.chdir(dir);
    process.env.INPUT_BASE = "HEAD";
    await $`git init -q -b main`;
    // At HEAD: a and b exist at 1.0.0; c does not exist yet.
    writePkg(dir, "a", "1.0.0");
    writePkg(dir, "b", "1.0.0");
    await $`git add -A && git -c user.name=t -c user.email=t@t commit -qm base`;
  });

  afterAll(() => {
    delete process.env.INPUT_BASE;
    process.chdir(cwd);
    rmSync(dir, { recursive: true, force: true });
  });

  test("keeps the packages whose version changed, with their group", async () => {
    const grp = group();
    const released = await findReleased([pkg(dir, "a", "1.1.0"), pkg(dir, "b", "1.0.0")], (name) =>
      name === "a" || name === "b" ? grp : undefined,
    );
    expect(released).toEqual([{ pkg: pkg(dir, "a", "1.1.0"), group: grp }]);
  });

  test("a package that did not exist at the base counts as released", async () => {
    const grp = group();
    const released = await findReleased([pkg(dir, "c", "0.1.0")], () => grp);
    expect(released.map(({ pkg }) => pkg.name)).toEqual(["c"]);
  });

  test("a package outside every group is skipped, even when its version changed", async () => {
    const released = await findReleased([pkg(dir, "a", "2.0.0")], () => undefined);
    expect(released).toEqual([]);
  });
});

describe("planTags", () => {
  const cwd = process.cwd();
  let dir = "";

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "nf-plan-tags-"));
    process.chdir(dir);
  });

  afterAll(() => {
    process.chdir(cwd);
    rmSync(dir, { recursive: true, force: true });
  });

  test("independent versioning tags every package and reads its own changelog", async () => {
    const grp = group({ name: "ind", versioning: "independent", tagFormat: "{package}@{version}" });
    writePkg(dir, "a", "1.1.0", "# [a@1.1.0](https://example.com) - (2026-01-01)\n\n- a change\n");
    writePkg(dir, "b", "2.0.0", "# [b@2.0.0](https://example.com) - (2026-01-01)\n\n- b change\n");
    const tagged = await planTags([
      { pkg: pkg(dir, "a", "1.1.0"), group: grp },
      { pkg: pkg(dir, "b", "2.0.0"), group: grp },
    ]);
    expect(tagged).toEqual([
      { group: grp, version: "1.1.0", tag: "a@1.1.0", changelog: "- a change\n" },
      { group: grp, version: "2.0.0", tag: "b@2.0.0", changelog: "- b change\n" },
    ]);
  });

  test("a shared group with one package tags it and reads its changelog", async () => {
    const grp = group({ name: "one" });
    writePkg(dir, "a", "1.1.0", "# [a@1.1.0](https://example.com) - (2026-01-01)\n\n- a change\n");
    const tagged = await planTags([{ pkg: pkg(dir, "a", "1.1.0"), group: grp }]);
    expect(tagged).toEqual([
      { group: grp, version: "1.1.0", tag: "one@1.1.0", changelog: "- a change\n" },
    ]);
  });

  test("a shared group with several packages reads the root changelog", async () => {
    const grp = group({ name: "many" });
    writeFileSync(
      join(dir, "CHANGELOG.md"),
      "# Changelog\n\n# [3.0.0](https://example.com) - (2026-01-01)\n\n- root change\n",
    );
    const tagged = await planTags([
      { pkg: pkg(dir, "a", "3.0.0"), group: grp },
      { pkg: pkg(dir, "b", "3.0.0"), group: grp },
    ]);
    expect(tagged).toEqual([
      { group: grp, version: "3.0.0", tag: "many@3.0.0", changelog: "- root change\n" },
    ]);
  });

  test("a shared group releasing several versions fails", async () => {
    const grp = group({ name: "many" });
    await expect(
      planTags([
        { pkg: pkg(dir, "a", "3.0.0"), group: grp },
        { pkg: pkg(dir, "b", "3.1.0"), group: grp },
      ]),
    ).rejects.toThrow('Group "many" is shared but released several versions: 3.0.0, 3.1.0');
  });

  test("a package without a changelog section gets an undefined changelog", async () => {
    const grp = group({ name: "one" });
    writePkg(dir, "a", "4.0.0");
    const tagged = await planTags([{ pkg: pkg(dir, "a", "4.0.0"), group: grp }]);
    expect(tagged[0]?.changelog).toBeUndefined();
  });
});
