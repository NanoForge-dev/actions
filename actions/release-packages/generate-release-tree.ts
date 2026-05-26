import { $ } from "bun";

import { readPackageChangelog } from "../../lib";

interface PnpmTreeDependency {
  from: string;
  path: string;
  version: string;
}

interface PnpmTree {
  dependencies?: Record<string, PnpmTreeDependency>;
  name?: string;
  path: string;
  private?: boolean;
  version?: string;
}

export interface ReleaseEntry {
  changelog?: string;
  dependsOn?: string[];
  name: string;
  path: string;
  private: boolean;
  version: string;
}

export const generateReleaseTree = async (packageNames: string[]): Promise<ReleaseEntry[][]> => {
  const packageList: PnpmTree[] =
    await $`pnpm list --recursive --only-projects --prod --json`.json();

  const nameSet = new Set(packageNames);
  let releaseEntries: ReleaseEntry[] = [];

  for (const pkg of packageList) {
    if (!pkg.name || !pkg.version) continue;
    if (!nameSet.has(pkg.name)) continue;

    const entry: ReleaseEntry = {
      name: pkg.name,
      version: pkg.version,
      path: pkg.path,
      private: pkg.private ?? false,
      changelog: await readPackageChangelog(pkg.path, pkg.name, pkg.version),
    };

    if (pkg.dependencies) {
      const internalDeps = Object.keys(pkg.dependencies).filter((dep) => nameSet.has(dep));
      if (internalDeps.length) entry.dependsOn = internalDeps;
    }

    releaseEntries.push(entry);
  }

  const foundNames = new Set(releaseEntries.map((e) => e.name));
  const missing = packageNames.filter((n) => !foundNames.has(n));
  if (missing.length) {
    throw new Error(`Packages not found in workspace: ${missing.join(", ")}`);
  }

  const releaseTree: ReleaseEntry[][] = [];
  const released = new Set<string>();

  while (releaseEntries.length) {
    const nextBatch: ReleaseEntry[] = [];
    const remaining: ReleaseEntry[] = [];

    for (const entry of releaseEntries) {
      if (!entry.dependsOn || entry.dependsOn.every((dep) => released.has(dep))) {
        nextBatch.push(entry);
      } else {
        remaining.push(entry);
      }
    }

    if (releaseEntries.length === remaining.length) {
      throw new Error(
        `Unresolvable dependency order among: ${remaining.map((e) => e.name).join(", ")}`,
      );
    }

    for (const entry of nextBatch) released.add(entry.name);

    releaseTree.push(nextBatch);
    releaseEntries = remaining;
  }

  return releaseTree;
};
