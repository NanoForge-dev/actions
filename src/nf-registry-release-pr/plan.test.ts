import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "path";

import { isNewerThan, nfRegistryVersions } from "../lib/registry";
import {
  MANIFEST_FILE_NAME,
  listNfPackages,
  setManifestVersion,
} from "../nf-registry-release/packages";
import { planNfVersion } from "./plan";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

test("planNfVersion releases a package never published at 1.0.0", () => {
  expect(planNfVersion("", [], undefined)).toEqual({
    version: "1.0.0",
    reason: "first release",
    changed: true,
  });
});

test("planNfVersion keeps a manifest version newer than the registry", () => {
  expect(planNfVersion("1.2.0", ["1.0.0", "1.1.0"], "minor")).toEqual({
    version: "1.2.0",
    reason: "not on the registry yet",
    changed: false,
  });
});

test("planNfVersion bumps a published version only when its commits ask for it", () => {
  expect(planNfVersion("1.1.0", ["1.0.0", "1.1.0"], "patch")?.version).toBe("1.1.1");
  expect(planNfVersion("1.1.0", ["1.1.0"], undefined)).toBeUndefined();
});

test("planNfVersion bumps from the highest version, never into a published one", () => {
  expect(planNfVersion("1.0.0", ["1.0.0", "2.0.0"], "minor")?.version).toBe("2.1.0");
});

test("planNfVersion gives a manifest with no version the registry's latest", () => {
  expect(planNfVersion("", ["1.3.0"], undefined)).toEqual({
    version: "1.3.0",
    reason: "version from the registry",
    changed: true,
  });
  expect(planNfVersion("", ["1.3.0"], "major")?.version).toBe("2.0.0");
});

test("isNewerThan is true only above every published version", () => {
  expect(isNewerThan("1.0.0", [])).toBe(true);
  expect(isNewerThan("1.1.0", ["1.0.0"])).toBe(true);
  expect(isNewerThan("1.0.0", ["1.0.0"])).toBe(false);
  expect(isNewerThan("1.0.0", ["1.1.0-beta.1"])).toBe(false);
});

test("nfRegistryVersions reads the packument and treats 404 as never published", async () => {
  const urls: string[] = [];
  globalThis.fetch = (async (url: string) => {
    urls.push(url);
    return url.endsWith("/@nf/missing")
      ? new Response("", { status: 404 })
      : Response.json({ versions: { "1.0.0": {}, "1.1.0": {} } });
  }) as typeof fetch;

  expect(await nfRegistryVersions("@nf/body")).toEqual(["1.0.0", "1.1.0"]);
  expect(await nfRegistryVersions("@nf/missing")).toEqual([]);
  expect(urls).toEqual([
    "https://api.nanoforge.eu/registry/@nf/body",
    "https://api.nanoforge.eu/registry/@nf/missing",
  ]);
});

test("nfRegistryVersions fails on a registry error instead of publishing blindly", async () => {
  globalThis.fetch = (async () => new Response("", { status: 503 })) as unknown as typeof fetch;
  await expect(nfRegistryVersions("@nf/body")).rejects.toThrow(/503/);
});

test("setManifestVersion edits only the version line, or adds one after the name", () => {
  const dir = mkdtempSync(join(tmpdir(), "nf-manifest-"));
  const file = join(dir, MANIFEST_FILE_NAME);
  const withoutVersion =
    '{\n  "name": "@nf/body",\n  "type": "component",\n  "tags": ["base", "physics"]\n}\n';
  writeFileSync(file, withoutVersion);

  const [pkg] = listNfPackages(dir);
  if (!pkg) throw new Error("manifest not listed");
  expect(pkg).toMatchObject({ name: "@nf/body", version: "" });
  setManifestVersion(pkg, "1.0.0");
  expect(readFileSync(file, "utf-8")).toBe(
    '{\n  "name": "@nf/body",\n  "version": "1.0.0",\n  "type": "component",\n  "tags": ["base", "physics"]\n}\n',
  );

  setManifestVersion({ ...pkg, version: "1.0.0" }, "1.1.0");
  expect(readFileSync(file, "utf-8")).toContain('"version": "1.1.0",\n  "type"');
});

test("listNfPackages reads dependencies as a list or as ranges", () => {
  const dir = mkdtempSync(join(tmpdir(), "nf-deps-"));
  writeFileSync(
    join(dir, MANIFEST_FILE_NAME),
    JSON.stringify({ name: "@nf/a", version: "1.0.0", dependencies: { "@nf/b": "^1.0.0" } }),
  );
  expect(listNfPackages(dir)[0]?.dependsOn).toEqual(["@nf/b"]);
});
