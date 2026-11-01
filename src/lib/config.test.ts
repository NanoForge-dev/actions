import { describe, expect, test } from "bun:test";

import { type ReleaseGroup, parseConfig, selectGroup, selectPackages } from "./config";
import { formatString } from "./format";

const group = (overrides: object = {}): ReleaseGroup =>
  parseConfig({ groups: [{ name: "g", packages: ["@s/a", "@s/b", "@s/c"], ...overrides }] })
    .groups[0] as ReleaseGroup;

describe("parseConfig", () => {
  test("fills shared defaults", () => {
    expect(group()).toMatchObject({
      mode: "all",
      versioning: "shared",
      npm: true,
      githubRelease: true,
      latest: true,
      tagFormat: "{version}",
      branchFormat: "releases/{name}@{version}",
      majorTag: false,
      betaOnMerge: false,
    });
  });

  test("fills independent defaults", () => {
    expect(group({ versioning: "independent" })).toMatchObject({
      latest: false,
      tagFormat: "{package}@{version}",
      branchFormat: "releases/{name}/{run}",
      commitFormat: "chore({name}): release {packages}",
    });
  });

  test.each([
    [{}, /groups/],
    [{ groups: [{ name: "g" }] }, /packages/],
    [{ groups: [{ name: "g", packages: ["a"], mode: "many" }] }, /mode/],
    [
      {
        groups: [
          { name: "g", packages: ["a"] },
          { name: "g", packages: ["b"] },
        ],
      },
      /defined twice/,
    ],
    [
      {
        groups: [
          { name: "g", packages: ["a"] },
          { name: "h", packages: ["a"] },
        ],
      },
      /in groups/,
    ],
    [{ groups: [{ name: "g", packages: ["a"] }], docs: {} }, /docs.category/],
    [{ groups: [{ name: "g", packages: ["a"], betaOnmerge: true }] }, /unknown key.*betaOnmerge/],
    [{ groups: [{ name: "g", packages: ["a"] }], extra: 1 }, /unknown key.*extra/],
    [{ groups: [{ name: "g", packages: ["a"], branchFormat: "release/{version}" }] }, /releases\//],
    [
      {
        groups: [
          { name: "g", packages: ["a"] },
          { name: "h", packages: ["b"] },
        ],
      },
      /share the tag format/,
    ],
    [
      { groups: [{ name: "g", packages: ["a"] }], docs: { category: "cli", group: "x" } },
      /not a group/,
    ],
  ])("rejects %j", (raw, error) => expect(() => parseConfig(raw)).toThrow(error));

  test("reads docs with defaults", () => {
    expect(
      parseConfig({ groups: [{ name: "g", packages: ["a"] }], docs: { category: "cli" } }).docs,
    ).toEqual({
      group: "g",
      category: "cli",
      references: false,
      referencesPath: "docs/references",
    });
  });
});

test("groups can share a tag format that names them", () => {
  const raw = {
    groups: [
      { name: "g", packages: ["a"] },
      { name: "h", packages: ["b"], versioning: "independent" },
    ],
  };
  expect(parseConfig(raw).groups.map((group) => group.tagFormat)).toEqual([
    "{version}",
    "{package}@{version}",
  ]);
});

test("selectGroup defaults to the first group and rejects unknown ones", () => {
  const config = parseConfig({
    groups: [
      { name: "g", packages: ["a"] },
      { name: "h", packages: ["b"], tagFormat: "{name}@{version}" },
    ],
  });
  expect(selectGroup(config, "").name).toBe("g");
  expect(selectGroup(config, "h").name).toBe("h");
  expect(() => selectGroup(config, "x")).toThrow(/Unknown group/);
});

describe("selectPackages", () => {
  test("all: every package, no subset", () => {
    expect(selectPackages(group(), [])).toEqual(["@s/a", "@s/b", "@s/c"]);
    expect(() => selectPackages(group(), ["@s/a"])).toThrow(/all its packages/);
  });

  test("single: exactly one", () => {
    const single = group({ mode: "single" });
    expect(selectPackages(single, ["@s/b"])).toEqual(["@s/b"]);
    expect(() => selectPackages(single, [])).toThrow(/exactly one/);
    expect(() => selectPackages(single, ["@s/a", "@s/b"])).toThrow(/exactly one/);
  });

  test("single with one package needs no input", () => {
    const only = parseConfig({ groups: [{ name: "g", packages: ["@s/a"], mode: "single" }] })
      .groups[0] as ReleaseGroup;
    expect(selectPackages(only, [])).toEqual(["@s/a"]);
  });

  test("some: any subset, empty = all", () => {
    const some = group({ mode: "some" });
    expect(selectPackages(some, ["@s/a", "@s/c"])).toEqual(["@s/a", "@s/c"]);
    expect(selectPackages(some, [])).toEqual(["@s/a", "@s/b", "@s/c"]);
  });

  test("rejects packages outside the group", () => {
    expect(() => selectPackages(group({ mode: "some" }), ["@s/z"])).toThrow(/Not in group/);
  });
});

describe("formatString", () => {
  const tokens = { name: "engine", version: "1.2.0", packages: "@s/a@1.2.0", run: "42" };
  test("replaces tokens", () => {
    expect(formatString("releases/{name}@{version}", tokens)).toBe("releases/engine@1.2.0");
    expect(formatString("releases/{name}/{run}", tokens)).toBe("releases/engine/42");
  });
  test("refuses a token without a value", () => {
    expect(() => formatString("{package}@{version}", tokens)).toThrow(/\{package\}/);
  });
});
