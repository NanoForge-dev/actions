import { endGroup, info, setFailed, setOutput, startGroup } from "@actions/core";
import { $ } from "bun";

import { headSha, tagExists } from "../lib/git";
import { createTag } from "../lib/github";
import { getBoolean, getList, getString } from "../lib/inputs";
import {
  NF_REGISTRY_URL,
  isNewerThan,
  isOnNfRegistry,
  nfRegistryVersions,
  waitUntil,
} from "../lib/registry";
import { sortReleaseTree } from "../lib/release-tree";
import { writeSummary } from "../lib/summary";
import {
  type NfPackage,
  assertNfPackages,
  listNfPackages,
  nfTag,
  selectNfPackages,
} from "./packages";

/**
 * Only versions above everything on the registry, and never tagged, are published: the others were released
 * already (a tagged version missing from the registry was unpublished, and its number can't be reused).
 */
const splitNewer = async (pkgs: NfPackage[]) => {
  const newer: NfPackage[] = [];
  const skipped: string[] = [];
  for (const pkg of pkgs) {
    if (!pkg.version) skipped.push(`\`${pkg.name}\` (no version in its manifest)`);
    else if (await tagExists(nfTag(pkg.name, pkg.version)))
      skipped.push(
        `\`${pkg.name}@${pkg.version}\` (released before, tag \`${nfTag(pkg.name, pkg.version)}\`)`,
      );
    else if (!isNewerThan(pkg.version, await nfRegistryVersions(pkg.name)))
      skipped.push(`\`${pkg.name}@${pkg.version}\` (already on the registry)`);
    else newer.push(pkg);
  }
  return { newer, skipped };
};

const main = async () => {
  const dry = getBoolean("dry-run", false);
  const selected = selectNfPackages(
    assertNfPackages(listNfPackages(getString("path", "packages"))),
    getString("package"),
    getList("exclude"),
  );
  const { newer, skipped } = await splitNewer(selected);
  const tree = sortReleaseTree(newer);
  const sha = await headSha();

  const released: string[] = [];
  for (const [index, batch] of tree.entries()) {
    // Only a later batch needs the packages to be visible on the registry.
    const wait = index < tree.length - 1;
    startGroup(`Publishing ${batch.map(({ name, version }) => `${name}@${version}`).join(", ")}`);
    await Promise.all(
      batch.map(async ({ name, version, path }) => {
        const id = `${name}@${version}`;
        if (dry) info(`[DRY] Would publish ${id} and tag ${nfTag(name, version)}`);
        else {
          await $`nf publish -d ${path}`;
          await createTag(nfTag(name, version), sha);
          if (wait)
            await waitUntil(`${id} on the NanoForge registry`, () => isOnNfRegistry(name, version));
        }
        released.push(`[\`${id}\`](${NF_REGISTRY_URL}/${name}/${version})`);
      }),
    );
    endGroup();
  }

  setOutput("released", released.length ? "true" : "false");
  setOutput("packages", JSON.stringify(newer.map(({ name, version }) => ({ name, version }))));
  const ids = newer.map(({ name, version }) => `${name}@${version}`).join(", ");
  await writeSummary(`NanoForge registry release${ids ? `: ${ids}` : ""}`, dry, [
    ["Published", released],
    ["Not published", skipped],
  ]);
};

main().catch((error: unknown) => setFailed(error instanceof Error ? error.message : String(error)));
