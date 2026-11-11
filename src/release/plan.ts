import { join } from "path";

import { readPackageChangelog, readRootChangelog } from "../lib/changelog";
import { type ReleaseGroup } from "../lib/config";
import { formatString } from "../lib/format";
import { assertCommit, showFile } from "../lib/git";
import { getString } from "../lib/inputs";
import { type WorkspacePackage, repoRelative, rootPath } from "../lib/workspace";

export interface Released {
  pkg: WorkspacePackage;
  group: ReleaseGroup;
}

export interface Tagged {
  tag: string;
  version: string;
  changelog?: string;
  group: ReleaseGroup;
}

/** Packages of the config whose package.json version changed since `base` (the merged commit's parent). */
export const findReleased = async (
  workspace: WorkspacePackage[],
  groups: (pkg: string) => ReleaseGroup | undefined,
): Promise<Released[]> => {
  const released: Released[] = [];
  const base = getString("base", "HEAD^1");
  await assertCommit(base);
  for (const pkg of workspace) {
    const group = groups(pkg.name);
    if (!group) continue;
    const before = await showFile(base, join(repoRelative(pkg.path), "package.json"));
    const previous = before ? (JSON.parse(before) as { version?: string }).version : undefined;
    if (previous !== pkg.version) released.push({ pkg, group });
  }
  return released;
};

export const planTags = async (released: Released[]): Promise<Tagged[]> => {
  const tagged: Tagged[] = [];
  const groups = [...new Set(released.map(({ group }) => group))];

  for (const group of groups) {
    const pkgs = released.filter((entry) => entry.group === group).map(({ pkg }) => pkg);
    if (group.versioning === "independent") {
      for (const pkg of pkgs)
        tagged.push({
          group,
          version: pkg.version,
          tag: formatString(group.tagFormat, {
            name: group.name,
            package: pkg.name,
            version: pkg.version,
            packages: `${pkg.name}@${pkg.version}`,
            run: "",
          }),
          changelog: await readPackageChangelog(pkg.path, pkg.name, pkg.version),
        });
      continue;
    }

    const versions = [...new Set(pkgs.map((pkg) => pkg.version))];
    if (versions.length !== 1)
      throw new Error(
        `Group "${group.name}" is shared but released several versions: ${versions.join(", ")}`,
      );
    const version = versions[0] as string;
    const only = pkgs.length === 1 ? pkgs[0] : undefined;
    tagged.push({
      group,
      version,
      tag: formatString(group.tagFormat, {
        name: group.name,
        package: only?.name,
        version,
        packages: pkgs.map((pkg) => `${pkg.name}@${version}`).join(", "),
        run: "",
      }),
      changelog: only
        ? await readPackageChangelog(only.path, only.name, version)
        : await readRootChangelog(rootPath(), version),
    });
  }
  return tagged;
};
