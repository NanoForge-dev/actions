import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "path";

import { updateRootChangelog } from "./root-changelog";
import { type WorkspacePackage } from "./workspace";

const today = new Date().toISOString().slice(0, 10);

const setup = (rootPkgJson: unknown): string => {
  const dir = mkdtempSync(join(tmpdir(), "nf-root-changelog-"));
  writeFileSync(join(dir, "package.json"), JSON.stringify(rootPkgJson));
  return dir;
};

const addPkg = (dir: string, name: string, changelog: string): WorkspacePackage => {
  const path = join(dir, "packages", name);
  mkdirSync(path, { recursive: true });
  writeFileSync(join(path, "package.json"), JSON.stringify({ name, version: "1.0.0" }));
  writeFileSync(join(path, "CHANGELOG.md"), changelog);
  return { name, version: "1.0.0", path, private: false, dependsOn: [] };
};

const section = (name: string, version: string, body: string) =>
  `# [${name}@${version}](https://example.com) - (2026-01-01)\n\n${body}\n`;

describe("updateRootChangelog", () => {
  test("creates the root changelog when there is none", async () => {
    const dir = setup({ name: "root-name" });
    const a = addPkg(dir, "a", section("a", "1.0.0", "## Features\n\n- did x"));
    await updateRootChangelog(dir, [a], "1.0.0");
    const content = readFileSync(join(dir, "CHANGELOG.md"), "utf8");
    expect(content).toBe(
      `# Changelog\n\nAll notable changes to this project will be documented in this file.\n\n` +
        `# 1.0.0 - (${today})\n\n## Features\n\n- did x\n\n`,
    );
    rmSync(dir, { recursive: true, force: true });
  });

  test("inserts the new entry before the previous version, with a compare link", async () => {
    const dir = setup({
      name: "root-name",
      repository: { url: "git+https://github.com/Org/Repo.git" },
    });
    writeFileSync(
      join(dir, "CHANGELOG.md"),
      `# Changelog\n\n# [0.9.0](https://github.com/Org/Repo/compare/root-name@0.8.0...root-name@0.9.0) - (2025-12-01)\n\n## Features\n\n- old\n`,
    );
    const a = addPkg(dir, "a", section("a", "1.0.0", "## Bug Fixes\n\n- fixed y"));
    await updateRootChangelog(dir, [a], "1.0.0");
    const content = readFileSync(join(dir, "CHANGELOG.md"), "utf8");
    expect(content).toContain(
      `# [1.0.0](https://github.com/Org/Repo/compare/root-name@0.9.0...root-name@1.0.0) - (${today})\n\n## Bug Fixes\n\n- fixed y`,
    );
    expect(content.indexOf("# [1.0.0]")).toBeLessThan(content.indexOf("# [0.9.0]"));
    rmSync(dir, { recursive: true, force: true });
  });

  test("merges the packages' sections and drops lines sharing a commit hash", async () => {
    const dir = setup({ name: "root-name" });
    const a = addPkg(
      dir,
      "a",
      section(
        "a",
        "1.0.0",
        "## Features\n\n- first wording (abc1234](https://github.com/Org/Repo/commit/abc1234))",
      ),
    );
    const b = addPkg(
      dir,
      "b",
      section(
        "b",
        "1.0.0",
        "## Features\n\n- second wording (abc1234](https://github.com/Org/Repo/commit/abc1234))\n- unique (def5678](https://github.com/Org/Repo/commit/def5678))",
      ),
    );
    await updateRootChangelog(dir, [a, b], "1.0.0");
    const content = readFileSync(join(dir, "CHANGELOG.md"), "utf8");
    expect(content).toContain("- first wording");
    expect(content).not.toContain("- second wording");
    expect(content).toContain("- unique");
    rmSync(dir, { recursive: true, force: true });
  });

  test("writes nothing when no package has a section for the version", async () => {
    const dir = setup({ name: "root-name" });
    const a = addPkg(dir, "a", section("a", "0.5.0", "## Features\n\n- old"));
    await updateRootChangelog(dir, [a], "1.0.0");
    expect(existsSync(join(dir, "CHANGELOG.md"))).toBe(false);
    rmSync(dir, { recursive: true, force: true });
  });
});
