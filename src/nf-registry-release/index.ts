import { endGroup, info, setFailed, startGroup } from "@actions/core";
import { $ } from "bun";

import { getBoolean, getList, getString } from "../lib/inputs";
import { NF_REGISTRY_URL, isOnNfRegistry, waitUntil } from "../lib/registry";
import { sortReleaseTree } from "../lib/release-tree";
import { writeSummary } from "../lib/summary";
import { listNfPackages, selectNfPackages } from "./packages";

const main = async () => {
  const dry = getBoolean("dry-run", false);
  const tree = sortReleaseTree(
    selectNfPackages(
      listNfPackages(getString("path", "packages")),
      getString("package"),
      getList("exclude"),
    ),
  );

  const released: string[] = [];
  for (const batch of tree) {
    startGroup(`Releasing ${batch.map(({ name }) => name).join(", ")}`);
    await Promise.all(
      batch.map(async ({ name, path }) => {
        if (dry) info(`[DRY] Would release ${name}`);
        else {
          await $`nf publish -d ${path}`;
          await waitUntil(`${name} on the NanoForge registry`, () => isOnNfRegistry(name));
        }
        released.push(`[${name}](${NF_REGISTRY_URL}/${name})`);
      }),
    );
    endGroup();
  }

  await writeSummary("NanoForge registry release", dry, [["Released", released]]);
};

main().catch((error: unknown) => setFailed(error instanceof Error ? error.message : String(error)));
