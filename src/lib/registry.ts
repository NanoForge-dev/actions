import { info } from "@actions/core";
import { sleep } from "bun";

const TIMEOUT_MS = 5 * 60 * 1_000;
const INTERVAL_MS = 15_000;

export const NF_REGISTRY_URL = "https://api.nanoforge.eu/registry";

export const isOnNpm = async (name: string, version: string): Promise<boolean> =>
  (await fetch(`https://registry.npmjs.org/${name}/${version}`)).ok;

export const isOnNfRegistry = async (name: string): Promise<boolean> =>
  (await fetch(`${NF_REGISTRY_URL}/${name}`)).ok;

/** Polls `check` until it is true, so a dependent package never publishes before its dependency is visible. */
export const waitUntil = async (label: string, check: () => Promise<boolean>): Promise<void> => {
  const deadline = performance.now() + TIMEOUT_MS;
  while (!(await check())) {
    if (performance.now() > deadline) throw new Error(`Timed out waiting for ${label}`);
    info(`Waiting for ${label}...`);
    await sleep(INTERVAL_MS);
  }
};
