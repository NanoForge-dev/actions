import { info } from "@actions/core";
import { $ } from "bun";

import type { ReleaseEntry } from "./generate-release-tree";

async function checkRegistry(release: ReleaseEntry) {
  const res = await fetch(`https://api.nanoforge.eu/registry/${release.name}`);
  return res.ok;
}

export async function releasePackage(release: ReleaseEntry, dry: boolean) {
  if (dry) {
    info(`[DRY] Releasing ${release.name}`);
  } else {
    await $`bun exec "nf publish -d ${release.path}"`;
  }

  if (dry) return true;

  const before = performance.now();

  // Poll registry to ensure next publishes won't fail
  await new Promise<void>((resolve, reject) => {
    const interval = setInterval(async () => {
      if (await checkRegistry(release)) {
        clearInterval(interval);
        resolve();
        return;
      }

      if (performance.now() > before + 5 * 60 * 1_000) {
        clearInterval(interval);
        reject(new Error(`Release for ${release.name} failed.`));
      }
    }, 15_000);
  });

  return true;
}
