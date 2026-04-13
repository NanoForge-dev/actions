import * as fs from "node:fs";
import { join } from "path";

interface nfTree {
  name?: string;
  path: string;
  dependencies?: string[];
}

export interface ReleaseEntry {
  name: string;
  path: string;
  dependsOn?: string[];
}

const MANIFEST_FILE_NAME = "nanoforge.manifest.json";

const handlePackage = (dirent: fs.Dirent): nfTree => {
  const manifestPath = join(dirent.parentPath, dirent.name);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as {
    name: string;
    dependencies?: string[];
  };
  return {
    name: manifest.name,
    path: dirent.parentPath,
    dependencies: manifest.dependencies,
  };
};

const getPackageList = (path: string): nfTree[] => {
  const dirs = fs.readdirSync(path, { recursive: true, withFileTypes: true });
  return dirs
    .filter((dirent) => dirent.isFile() && dirent.name === MANIFEST_FILE_NAME)
    .map((dirent) => handlePackage(dirent));
};

async function getReleaseEntries(path: string) {
  const releaseEntries: ReleaseEntry[] = [];
  const packageList: nfTree[] = getPackageList(path);

  for (const pkg of packageList) {
    // Just in case
    if (!pkg.name) continue;

    const release: ReleaseEntry = {
      name: pkg.name,
      path: pkg.path,
    };

    if (pkg.dependencies) {
      release.dependsOn = pkg.dependencies;
    }

    releaseEntries.push(release);
  }

  return releaseEntries;
}

export async function generateReleaseTree(path: string, packageName?: string, exclude?: string[]) {
  let releaseEntries = await getReleaseEntries(path);
  // Try to early return if the package doesn't have deps
  if (packageName && packageName !== "all") {
    const releaseEntry = releaseEntries.find((entry) => entry.name === packageName);
    if (!releaseEntry) {
      throw new Error(`Package ${packageName} not releaseable`);
    }

    if (!releaseEntry.dependsOn) {
      return [[releaseEntry]];
    }
  }

  // Generate the whole tree first, then prune if specified
  const releaseTree: ReleaseEntry[][] = [];
  const didRelease = new Set<string>();

  while (releaseEntries.length) {
    const nextBranch: ReleaseEntry[] = [];
    const unreleased: ReleaseEntry[] = [];
    for (const entry of releaseEntries) {
      if (!entry.dependsOn) {
        nextBranch.push(entry);
        continue;
      }

      const allDepsReleased = entry.dependsOn.every((dep) => didRelease.has(dep));
      if (allDepsReleased) {
        nextBranch.push(entry);
      } else {
        unreleased.push(entry);
      }
    }

    // Update didRelease in a second loop to avoid loop order issues
    for (const release of nextBranch) {
      didRelease.add(release.name);
    }

    if (releaseEntries.length === unreleased.length) {
      throw new Error(
        `One or more packages have dependents that can't be released: ${unreleased.map((entry) => entry.name).join(",")}`,
      );
    }

    releaseTree.push(nextBranch);
    releaseEntries = unreleased;
  }

  // Prune exclusions
  if ((!packageName || packageName === "all") && Array.isArray(exclude) && exclude.length) {
    const neededPackages = new Set<string>();
    const excludedReleaseTree: ReleaseEntry[][] = [];

    for (const releaseBranch of releaseTree.reverse()) {
      const newThisBranch: ReleaseEntry[] = [];

      for (const entry of releaseBranch) {
        if (exclude.includes(entry.name) && !neededPackages.has(entry.name)) {
          continue;
        }

        newThisBranch.push(entry);
        for (const dep of entry.dependsOn ?? []) {
          neededPackages.add(dep);
        }
      }

      if (newThisBranch.length) excludedReleaseTree.unshift(newThisBranch);
    }

    return excludedReleaseTree;
  }

  if (!packageName || packageName === "all") {
    return releaseTree;
  }

  // Prune the tree for the specified package
  const neededPackages = new Set<string>([packageName]);
  const packageReleaseTree: ReleaseEntry[][] = [];

  for (const releaseBranch of releaseTree.reverse()) {
    const newThisBranch: ReleaseEntry[] = [];

    for (const entry of releaseBranch) {
      if (neededPackages.has(entry.name)) {
        newThisBranch.push(entry);
        for (const dep of entry.dependsOn ?? []) {
          neededPackages.add(dep);
        }
      }
    }

    if (newThisBranch.length) packageReleaseTree.unshift(newThisBranch);
  }

  return packageReleaseTree;
}
