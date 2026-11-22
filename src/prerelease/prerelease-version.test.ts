import { describe, expect, test } from "bun:test";

import { resolveAlphaRelease } from "./prerelease-version";

describe("resolveAlphaRelease", () => {
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
