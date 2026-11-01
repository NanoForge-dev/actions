import { readFileSync, readdirSync } from "node:fs";
import { join } from "path";

import { type TreeNode, withDependencies } from "../lib/release-tree";

const MANIFEST_FILE_NAME = "nanoforge.manifest.json";

export interface NfPackage extends TreeNode {
  path: string;
}

export const listNfPackages = (dir: string): NfPackage[] =>
  readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name === MANIFEST_FILE_NAME)
    .map((entry) => {
      const manifest = JSON.parse(readFileSync(join(entry.parentPath, entry.name), "utf-8")) as {
        name?: string;
        dependencies?: string[];
      };
      return {
        name: manifest.name ?? "",
        path: entry.parentPath,
        dependsOn: manifest.dependencies ?? [],
      };
    })
    .filter((pkg) => pkg.name);

/** One package (and what it needs), or everything but `exclude` (unless a released package needs it). */
export const selectNfPackages = (all: NfPackage[], pkg: string, exclude: string[]): NfPackage[] => {
  const names = new Set(all.map((candidate) => candidate.name));
  const missing = all.flatMap((candidate) =>
    candidate.dependsOn.filter((dep) => !names.has(dep)).map((dep) => `${candidate.name} → ${dep}`),
  );
  if (missing.length)
    throw new Error(`Dependencies not found in the packages directory: ${missing.join(", ")}`);

  if (pkg && pkg !== "all") {
    if (!names.has(pkg)) throw new Error(`Package ${pkg} not releasable`);
    return withDependencies(all, [pkg]);
  }
  return withDependencies(
    all,
    all.filter((candidate) => !exclude.includes(candidate.name)).map((candidate) => candidate.name),
  );
};
