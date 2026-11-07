import { $ } from "bun";
import { existsSync, readFileSync, readdirSync, rmSync } from "fs";
import { join } from "path";
import { major, rcompare, valid } from "semver";

import { type FolderPlan, writeFolder, writeJson } from "./folder";

export const generateReferences = async (path: string): Promise<void> => {
  await $`pnpm run docs`.cwd(path);
};

export const isVersion = (version: string): boolean => valid(version) === version;

/** The versions kept under references/<category>/: the highest of each major, newest first. */
export const keptVersions = (versions: string[]): string[] => {
  const sorted = versions.filter(isVersion).sort(rcompare);
  return sorted.filter(
    (version, index) => sorted.findIndex((other) => major(other) === major(version)) === index,
  );
};

/**
 * Writes the planned references to `root/<version>`, deletes every other entry of `root` (the folder belongs to the
 * source repo) except the kept versions, and rebuilds `root/navigation.json` from their own navigation files.
 */
export const writeReferences = (
  plan: FolderPlan,
  root: string,
  version: string,
): { kept: string[]; removed: string[] } => {
  writeFolder(plan, join(root, version));
  const entries = readdirSync(root).sort();
  const kept = keptVersions(
    entries.filter((name) => existsSync(join(root, name, "navigation.json"))),
  );
  const removed = entries.filter((name) => !kept.includes(name) && name !== "navigation.json");
  for (const name of removed) rmSync(join(root, name), { recursive: true, force: true });
  writeJson(
    join(root, "navigation.json"),
    kept.map((name, index) => ({
      version: name,
      ...(index === 0 ? { default: true } : {}),
      pages: JSON.parse(readFileSync(join(root, name, "navigation.json"), "utf8")),
    })),
  );
  return { kept, removed };
};
