import { info, warning } from "@actions/core";
import { $ } from "bun";

export const publishDev = async (
  pkgName: string,
  version: string,
  tag: string,
  dry: boolean,
): Promise<void> => {
  if (dry) {
    info(`[DRY] Publishing ${pkgName}@${version} with tag ${tag}`);
    return;
  }

  await $`pnpm --filter=${pkgName} publish --provenance --no-git-checks --tag ${tag}`;
};

export const deprecateOldDevVersions = async (
  pkgName: string,
  versionsToDeprecate: string[],
  supersededBy: string,
  dry: boolean,
): Promise<void> => {
  if (!versionsToDeprecate.length) return;

  const message = `Superseded by ${pkgName}@${supersededBy}`;

  for (const version of versionsToDeprecate) {
    if (dry) {
      info(`[DRY] Deprecating ${pkgName}@${version}`);
      continue;
    }

    try {
      await $`npm deprecate ${pkgName}@${version} ${message}`;
    } catch (error) {
      warning(`Failed to deprecate ${pkgName}@${version}: ${error}`);
    }
  }
};
