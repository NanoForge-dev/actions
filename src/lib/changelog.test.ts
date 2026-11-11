import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "path";

import { readPackageChangelog, readRootChangelog } from "./changelog";

const dir = mkdtempSync(join(tmpdir(), "nf-changelog-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const writeChangelog = (name: string, content: string): string => {
  const pkgDir = join(dir, name);
  mkdirSync(pkgDir, { recursive: true });
  writeFileSync(join(pkgDir, "CHANGELOG.md"), content);
  return pkgDir;
};

const CONTENT = `# Changelog

# [@nanoforge-dev/actions@3.3.0](https://example.com/compare/x...y) - (2026-11-11)

### Features

- new thing

# [@nanoforge-dev/actions@3.2.0](https://example.com/compare/a...b) - (2026-11-01)

### Bug Fixes

- old thing
`;

describe("readPackageChangelog", () => {
  test("extracts the section of the name@version header, up to the next version", async () => {
    const pkgDir = writeChangelog("pkg", CONTENT);
    const section = await readPackageChangelog(pkgDir, "@nanoforge-dev/actions", "3.3.0");
    expect(section).toBe("### Features\n\n- new thing\n");
  });

  test("matches the bare version header too", async () => {
    const pkgDir = writeChangelog(
      "bare",
      `# [1.0.0](https://example.com) - (2026-01-01)\n\n- first\n`,
    );
    expect(await readPackageChangelog(pkgDir, "whatever", "1.0.0")).toBe("- first\n");
  });

  test("returns undefined when the version has no section", async () => {
    const pkgDir = writeChangelog("pkg2", CONTENT);
    expect(await readPackageChangelog(pkgDir, "@nanoforge-dev/actions", "9.9.9")).toBeUndefined();
  });

  test("returns undefined when the package has no changelog", async () => {
    expect(await readPackageChangelog(join(dir, "missing"), "pkg", "1.0.0")).toBeUndefined();
  });
});

describe("readRootChangelog", () => {
  test("extracts the section of the bare version header", async () => {
    const rootDir = writeChangelog(
      "root",
      `# Changelog\n\n# [2.0.0](https://example.com) - (2026-02-02)\n\n- root change\n\n# [1.0.0](https://example.com) - (2026-01-01)\n\n- older\n`,
    );
    expect(await readRootChangelog(rootDir, "2.0.0")).toBe("- root change\n");
    expect(await readRootChangelog(rootDir, "1.0.0")).toBe("- older\n");
  });

  test("does not match a name@version header", async () => {
    const rootDir = writeChangelog("root2", CONTENT);
    expect(await readRootChangelog(rootDir, "3.3.0")).toBeUndefined();
  });

  test("returns undefined without a changelog file", async () => {
    expect(await readRootChangelog(join(dir, "missing"), "1.0.0")).toBeUndefined();
  });
});
