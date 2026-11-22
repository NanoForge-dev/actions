import { afterEach, describe, expect, test } from "bun:test";

import { fetchDevVersions, resolveAlphaRelease, resolveBetaRelease } from "./prerelease-version";

describe("resolveAlphaRelease", () => {
  test("starts at 0 for a new branch, bumping the patch of a stable version", () => {
    const result = resolveAlphaRelease("1.2.3", "feat/new-thing", []);
    expect(result).toEqual({ newVersion: "1.2.4-alpha.new-thing.0", toDeprecate: [] });
  });

  test("continues the numbering of the branch's existing alphas and deprecates them", () => {
    const result = resolveAlphaRelease("1.2.3", "feat/new-thing", [
      { version: "1.2.4-alpha.new-thing.0" },
      { version: "1.2.4-alpha.new-thing.2" },
      { version: "1.2.4-alpha.other-branch.5" },
    ]);
    expect(result.newVersion).toBe("1.2.4-alpha.new-thing.3");
    expect(result.toDeprecate).toEqual(["1.2.4-alpha.new-thing.0", "1.2.4-alpha.new-thing.2"]);
  });

  test("does not deprecate an alpha that is already deprecated", () => {
    const result = resolveAlphaRelease("1.2.3", "feat/new-thing", [
      { version: "1.2.4-alpha.new-thing.0", deprecated: "use a newer alpha" },
      { version: "1.2.4-alpha.new-thing.1" },
    ]);
    expect(result.newVersion).toBe("1.2.4-alpha.new-thing.2");
    expect(result.toDeprecate).toEqual(["1.2.4-alpha.new-thing.1"]);
  });

  test("counts the current version itself when it is an alpha of the branch", () => {
    const result = resolveAlphaRelease("1.2.4-alpha.new-thing.1", "feat/new-thing", []);
    expect(result.newVersion).toBe("1.2.4-alpha.new-thing.2");
    expect(result.toDeprecate).toEqual(["1.2.4-alpha.new-thing.1"]);
  });

  test("does not bump the patch again when the current version is already a prerelease", () => {
    const result = resolveAlphaRelease("1.3.0-beta.abc1234", "fix/bug", []);
    expect(result.newVersion).toBe("1.3.0-alpha.bug.0");
  });

  test("sanitizes the branch name into a prerelease slug", () => {
    expect(resolveAlphaRelease("1.2.3", "feature/Add_Thing Now", []).newVersion).toBe(
      "1.2.4-alpha.add-thing-now.0",
    );
    expect(resolveAlphaRelease("1.2.3", "toplevel", []).newVersion).toBe("1.2.4-alpha.toplevel.0");
  });

  test("throws on an invalid current version", () => {
    expect(() => resolveAlphaRelease("not-a-version", "feat/x", [])).toThrow(
      "Invalid semver version: not-a-version",
    );
  });
});

describe("resolveBetaRelease", () => {
  test("builds the beta version from the short commit sha", () => {
    const result = resolveBetaRelease("1.2.3", "abcdef1234567890", []);
    expect(result).toEqual({ newVersion: "1.2.4-beta.abcdef1", toDeprecate: [] });
  });

  test("deprecates the previous betas but not an already deprecated one", () => {
    const result = resolveBetaRelease("1.2.3", "abcdef1234567890", [
      { version: "1.2.4-beta.1111111" },
      { version: "1.2.4-beta.2222222", deprecated: "superseded" },
    ]);
    expect(result.toDeprecate).toEqual(["1.2.4-beta.1111111"]);
  });

  test("a re-run for the same commit does not deprecate its own beta", () => {
    const result = resolveBetaRelease("1.2.3", "abcdef1234567890", [
      { version: "1.2.4-beta.abcdef1" },
    ]);
    expect(result).toEqual({ newVersion: "1.2.4-beta.abcdef1", toDeprecate: [] });
  });

  test("does not bump the patch when the current version is already a prerelease", () => {
    const result = resolveBetaRelease("1.3.0-alpha.x.0", "abcdef1234567890", []);
    expect(result.newVersion).toBe("1.3.0-beta.abcdef1");
  });
});

describe("resolveAlphaRelease with the deprecation state npm lists (#133)", () => {
  test("does not deprecate the current version again when npm lists it as deprecated", () => {
    expect(
      resolveAlphaRelease("1.0.1-alpha.x.2", "feat/x", [
        { version: "1.0.1-alpha.x.2", deprecated: "Superseded" },
        { version: "1.0.1-alpha.x.1", deprecated: "S" },
      ]),
    ).toEqual({ newVersion: "1.0.1-alpha.x.3", toDeprecate: [] });
  });

  test("deprecates the current version once when npm lists it as not deprecated", () => {
    expect(
      resolveAlphaRelease("1.0.1-alpha.x.2", "feat/x", [
        { version: "1.0.1-alpha.x.2" },
        { version: "1.0.1-alpha.x.2" },
        { version: "1.0.1-alpha.x.1", deprecated: "S" },
      ]),
    ).toEqual({ newVersion: "1.0.1-alpha.x.3", toDeprecate: ["1.0.1-alpha.x.2"] });
  });

  test("deprecates the current version when npm does not list it yet", () => {
    expect(
      resolveAlphaRelease("1.0.1-alpha.x.2", "feat/x", [
        { version: "1.0.1-alpha.x.1", deprecated: "S" },
      ]),
    ).toEqual({ newVersion: "1.0.1-alpha.x.3", toDeprecate: ["1.0.1-alpha.x.2"] });
  });

  test("starts the branch at 0 from a stable version", () => {
    expect(resolveAlphaRelease("1.0.0", "feat/x", [])).toEqual({
      newVersion: "1.0.1-alpha.x.0",
      toDeprecate: [],
    });
  });
});

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

test("fetchDevVersions keeps only the versions on the requested channel", async () => {
  globalThis.fetch = (async () =>
    Response.json({
      versions: {
        "1.0.0": { version: "1.0.0" },
        "1.1.0-alpha.x.0": { version: "1.1.0-alpha.x.0" },
        "1.1.0-beta.abc1234": { version: "1.1.0-beta.abc1234" },
      },
    })) as unknown as typeof fetch;

  expect((await fetchDevVersions("@scope/pkg", "alpha")).map(({ version }) => version)).toEqual([
    "1.1.0-alpha.x.0",
  ]);
});

test("fetchDevVersions treats a 404 as never published", async () => {
  globalThis.fetch = (async () => new Response("", { status: 404 })) as unknown as typeof fetch;
  expect(await fetchDevVersions("@scope/missing", "alpha")).toEqual([]);
});

test("fetchDevVersions fails on a registry error instead of restarting the channel", async () => {
  globalThis.fetch = (async () => new Response("", { status: 429 })) as unknown as typeof fetch;
  await expect(fetchDevVersions("@scope/pkg", "alpha")).rejects.toThrow(/429/);
});
