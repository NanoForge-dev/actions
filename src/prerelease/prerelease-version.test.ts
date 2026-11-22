import { afterEach, describe, expect, test } from "bun:test";

import { fetchDevVersions, resolveAlphaRelease } from "./prerelease-version";

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
