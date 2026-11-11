import { afterEach, expect, test } from "bun:test";

import { fetchDevVersions } from "./prerelease-version";

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
