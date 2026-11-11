import { describe, expect, test } from "bun:test";

import { resolveAlphaRelease, resolveBetaRelease } from "./prerelease-version";

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
