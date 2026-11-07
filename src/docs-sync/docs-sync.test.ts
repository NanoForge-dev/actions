import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, symlinkSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { dirname, join } from "path";

import { planFolder } from "./folder";
import { rewriteLinks } from "./links";
import { prefixNavigation, validateNavigation } from "./navigation";
import { keptVersions, writeReferences } from "./references";

describe("validateNavigation", () => {
  const files = ["intro.mdx", "guide/setup.md", "img/logo.png"];

  test("accepts a nav listing every page once", () => {
    expect(
      validateNavigation(["intro", { group: "Guide", pages: ["guide/setup"] }], files),
    ).toEqual([]);
  });

  test("counts a group root as a listing", () => {
    expect(
      validateNavigation([{ group: "G", root: "intro", pages: ["guide/setup"] }], files),
    ).toEqual([]);
  });

  test("reports a missing page", () => {
    expect(validateNavigation(["intro", "guide/setup", "nope"], files)).toEqual([
      `navigation.json lists "nope": no nope.mdx or nope.md`,
    ]);
  });

  test("reports an orphan page", () => {
    expect(validateNavigation(["intro"], files)).toEqual([
      "guide/setup.md: not listed in navigation.json",
    ]);
  });

  test("reports a duplicate", () => {
    expect(
      validateNavigation(["intro", "guide/setup", { group: "G", pages: ["intro"] }], files),
    ).toEqual([`navigation.json lists "intro" 2 times`]);
  });

  test.each([
    ["../secret", "must not contain .."],
    ["guide/../intro", "must not contain .."],
    ["/intro", "must be a relative path"],
    ["intro.mdx", "must not have an extension"],
    ["./intro", "clean path"],
    [".hidden/x", "dot-folder"],
  ])("rejects the path %s", (path, message) => {
    expect(validateNavigation([path, "intro", "guide/setup"], files).join()).toContain(message);
  });

  test("reports every problem at once, plus README and .md/.mdx clashes", () => {
    const problems = validateNavigation(
      ["intro", "intro", "gone", { title: "x" }],
      [...files, "README.md", "guide/setup.mdx"],
    );
    expect(problems).toHaveLength(7);
  });

  test("prefixes pages and roots, keeps the other keys", () => {
    expect(
      prefixNavigation(
        [{ group: "G", icon: "rocket", root: "a", pages: ["b", { group: "H", pages: ["c"] }] }],
        "docs/x",
      ),
    ).toEqual([
      {
        group: "G",
        icon: "rocket",
        root: "docs/x/a",
        pages: ["docs/x/b", { group: "H", pages: ["docs/x/c"] }],
      },
    ]);
  });
});

describe("rewriteLinks", () => {
  const context = {
    pages: new Set(["intro", "guide/setup", "guide/index"]),
    files: new Set(["intro.mdx", "guide/setup.md", "guide/index.mdx", "img/logo.png"]),
    prefix: "docs/engine",
  };
  const rewrite = (content: string, file = "guide/setup.md") =>
    rewriteLinks(content, file, context);

  test("rewrites relative pages and assets to site paths", () => {
    expect(
      rewrite(
        '[a](../intro) [b](./index.mdx) ![l](../img/logo.png "Logo") <img src="../img/logo.png" /> [c](<../intro.mdx>)',
      ).content,
    ).toBe(
      '[a](/docs/engine/intro) [b](/docs/engine/guide/index) ![l](/docs/engine/img/logo.png "Logo") <img src="/docs/engine/img/logo.png" /> [c](</docs/engine/intro>)',
    );
  });

  test("rewrites links whose text is inline code", () => {
    expect(rewrite("[`Intro`](../intro.mdx).[`x`](../intro.mdx#x)").content).toBe(
      "[`Intro`](/docs/engine/intro).[`x`](/docs/engine/intro#x)",
    );
  });

  test("scans indented fences as code and rewrites link definitions", () => {
    const content = [
      "    ```ts",
      "    handlers[k](event);",
      "    ```",
      "[ref]: ../intro.mdx#x",
    ].join("\n");
    const result = rewrite(content);
    expect(result.problems).toEqual([]);
    expect(result.content.split("\n").at(-1)).toBe("[ref]: /docs/engine/intro#x");
  });

  test("keeps anchors and queries", () => {
    expect(rewrite("[a](../intro.mdx#install) [b](setup?x=1#y)").content).toBe(
      "[a](/docs/engine/intro#install) [b](/docs/engine/guide/setup?x=1#y)",
    );
  });

  test("leaves absolute, anchor and scheme links alone", () => {
    const content = `[a](/docs/cli/x) [b](#top) [c](https://x.dev) [d](mailto:a@b.c) <a href="//cdn.x/y">`;
    expect(rewrite(content)).toEqual({ content, problems: [] });
  });

  test("leaves code blocks and inline code alone", () => {
    const content = [
      "````md",
      "[a](./nope)",
      "```",
      "````",
      "~~~",
      "[b](./nope)",
      "~~~",
      "`[c](./nope)` [d](../intro)",
    ].join("\n");
    const result = rewrite(content);
    expect(result.problems).toEqual([]);
    expect(result.content.split("\n").at(-1)).toBe("`[c](./nope)` [d](/docs/engine/intro)");
  });

  test("reports unresolved and escaping links with their line", () => {
    expect(rewrite("ok\n[a](./nope) [b](../../outside) [c](../img/logo.mdx)").problems).toEqual([
      `guide/setup.md:2: link "./nope" is not a page or file of the synced folder`,
      `guide/setup.md:2: link "../../outside" leaves the synced folder`,
      `guide/setup.md:2: link "../img/logo.mdx" is not a page or file of the synced folder`,
    ]);
  });
});

const tree = (root: string, files: Record<string, string>) => {
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
};

describe("planFolder", () => {
  test("skips dot-folders and requires a title", () => {
    const src = mkdtempSync(join(tmpdir(), "docs-sync-"));
    tree(src, {
      "navigation.json": '["a", "b"]',
      "a.mdx": "---\ntitle: A\n---\n",
      "b.md": "no frontmatter",
      ".tsdocs/cache.mdx": "x",
    });
    expect(planFolder(src, "docs/x").problems).toEqual(["b.md: no frontmatter title"]);
  });

  test("refuses a symlinked root or navigation.json without reading through them", () => {
    const outside = mkdtempSync(join(tmpdir(), "docs-sync-"));
    tree(outside, {
      "navigation.json": '["a"]',
      "a.mdx": "---\ntitle: A\n---\n",
      "creds.txt": "SECRET",
    });
    const root = mkdtempSync(join(tmpdir(), "docs-sync-"));
    symlinkSync(outside, join(root, "docs"));
    expect(planFolder(join(root, "docs"), "docs/x")).toEqual({
      problems: [".: symlinks are not synced"],
    });

    // A symlinked parent between the checkout and the folder, and a folder outside the checkout.
    symlinkSync(outside, join(root, "parent"));
    expect(planFolder(join(root, "parent"), "docs/x", root).problems).toEqual([
      ".: symlinks are not synced",
    ]);
    expect(planFolder(outside, "docs/x", root).problems).toEqual([
      ".: outside the source repository",
    ]);

    const src = mkdtempSync(join(tmpdir(), "docs-sync-"));
    tree(src, { "a.mdx": "---\ntitle: A\n---\n" });
    symlinkSync(join(outside, "creds.txt"), join(src, "navigation.json"));
    const result = planFolder(src, "docs/x");
    expect(result.plan).toBeUndefined();
    expect(result.problems).toEqual(["navigation.json: symlinks are not synced"]);
  });
});

describe("references", () => {
  test("keeps the highest version of each major, newest first", () => {
    expect(
      keptVersions(["1.0.0", "2.0.0", "1.4.2", "2.1.0", "0.9.0", "upcoming", "v3.0.0", "1.10.0"]),
    ).toEqual(["2.1.0", "1.10.0", "0.9.0"]);
  });

  test("replaces the version, deletes every other entry and rebuilds the versions nav", () => {
    const base = mkdtempSync(join(tmpdir(), "docs-sync-"));
    const root = join(base, "references", "engine");
    tree(root, {
      "upcoming.mdx": "placeholder",
      "navigation.json": "[]",
      "1.0.0/navigation.json": "[]",
      "1.4.2/navigation.json": '["references/engine/1.4.2/core/index"]',
      "2.0.0/navigation.json": "[]",
      "2.1.0/stale.mdx": "stale",
      "notes/x.md": "x",
    });
    const src = join(base, "src");
    tree(src, { "navigation.json": '["core/index"]', "core/index.mdx": "---\ntitle: Core\n---\n" });
    const { plan } = planFolder(src, "references/engine/2.1.0");
    if (!plan) throw new Error("the references fixture is invalid");

    expect(writeReferences(plan, root, "2.1.0")).toEqual({
      kept: ["2.1.0", "1.4.2"],
      removed: ["1.0.0", "2.0.0", "notes", "upcoming.mdx"],
    });
    expect(readdirSync(root).sort()).toEqual(["1.4.2", "2.1.0", "navigation.json"]);
    expect(readdirSync(join(root, "2.1.0")).sort()).toEqual(["core", "navigation.json"]);
    expect(JSON.parse(readFileSync(join(root, "navigation.json"), "utf8"))).toEqual([
      { version: "2.1.0", default: true, pages: ["references/engine/2.1.0/core/index"] },
      { version: "1.4.2", pages: ["references/engine/1.4.2/core/index"] },
    ]);
  });
});
