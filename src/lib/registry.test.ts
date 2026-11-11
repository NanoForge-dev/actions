import { afterEach, expect, test } from "bun:test";

import { isOnNpm } from "./registry";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

test("isOnNpm answers true for a published version and false only on a 404", async () => {
  globalThis.fetch = (async (url: string) =>
    url.endsWith("/missing/1.0.0")
      ? new Response("", { status: 404 })
      : new Response("{}", { status: 200 })) as typeof fetch;

  expect(await isOnNpm("@scope/pkg", "1.0.0")).toBe(true);
  expect(await isOnNpm("@scope/missing", "1.0.0")).toBe(false);
});

test("isOnNpm fails on a registry error instead of reading it as not published", async () => {
  globalThis.fetch = (async () => new Response("", { status: 503 })) as unknown as typeof fetch;
  await expect(isOnNpm("@scope/pkg", "1.0.0")).rejects.toThrow(/503/);
});
