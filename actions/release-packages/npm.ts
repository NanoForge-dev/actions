import { info } from "@actions/core";
import { $ } from "bun";

import type { ReleaseEntry } from "./generate-release-tree";

const REGISTRY_TIMEOUT_MS = 5 * 60 * 1_000;
const REGISTRY_POLL_INTERVAL_MS = 15_000;

const checkRegistry = async (name: string, version: string): Promise<boolean> => {
  const res = await fetch(`https://registry.npmjs.org/${name}/${version}`);
  return res.ok;
};

const pollUntilAvailable = async (name: string, version: string): Promise<void> => {
  const deadline = performance.now() + REGISTRY_TIMEOUT_MS;

  await new Promise<void>((resolve, reject) => {
    const interval = setInterval(async () => {
      if (await checkRegistry(name, version)) {
        clearInterval(interval);
        resolve();
        return;
      }
      if (performance.now() > deadline) {
        clearInterval(interval);
        reject(new Error(`Timed out waiting for ${name}@${version} on the npm registry`));
      }
    }, REGISTRY_POLL_INTERVAL_MS);
  });
};

export const publishToNpm = async (entry: ReleaseEntry, dry: boolean): Promise<boolean> => {
  if (entry.private) {
    info(`${entry.name} is private, skipping npm publish.`);
    return false;
  }

  if (await checkRegistry(entry.name, entry.version)) {
    info(`${entry.name}@${entry.version} already published, skipping.`);
    return false;
  }

  if (dry) {
    info(`[DRY] Publishing ${entry.name}@${entry.version} to npm`);
    return true;
  }

  await $`pnpm --filter=${entry.name} publish --provenance --no-git-checks`;
  await pollUntilAvailable(entry.name, entry.version);

  return true;
};
