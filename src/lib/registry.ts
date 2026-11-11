import { info } from "@actions/core";
import { sleep } from "bun";
import semver from "semver";

const TIMEOUT_MS = 5 * 60 * 1_000;
const INTERVAL_MS = 15_000;

export const NF_REGISTRY_URL = "https://api.nanoforge.eu/registry";

/** The packument without contents or readme, as installers read it. */
const ABBREVIATED = "application/vnd.npm.install-v1+json";

/** Only a 404 means "not published": any other answer (429, 5xx, …) fails, like `nfRegistryVersions`. */
export const isOnNpm = async (name: string, version: string): Promise<boolean> => {
  const res = await fetch(`https://registry.npmjs.org/${name}/${version}`);
  if (res.status === 404) return false;
  if (!res.ok) throw new Error(`npm registry: GET ${name}/${version} answered ${res.status}`);
  return true;
};

/** Every version of `name` on the NanoForge registry: empty when the package was never published. */
export const nfRegistryVersions = async (name: string): Promise<string[]> => {
  const res = await fetch(`${NF_REGISTRY_URL}/${name}`, { headers: { accept: ABBREVIATED } });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`NanoForge registry: GET ${name} answered ${res.status}`);
  const { versions } = (await res.json()) as { versions?: Record<string, unknown> };
  return Object.keys(versions ?? {});
};

export const isOnNfRegistry = async (name: string, version: string): Promise<boolean> =>
  (await nfRegistryVersions(name)).includes(version);

/** `version` is above every version on the registry, so publishing it can't collide (409). */
export const isNewerThan = (version: string, published: string[]): boolean =>
  published.every((other) => semver.gt(version, other));

/** Polls `check` until it is true, so a dependent package never publishes before its dependency is visible. */
export const waitUntil = async (label: string, check: () => Promise<boolean>): Promise<void> => {
  const deadline = performance.now() + TIMEOUT_MS;
  while (!(await check())) {
    if (performance.now() > deadline) throw new Error(`Timed out waiting for ${label}`);
    info(`Waiting for ${label}...`);
    await sleep(INTERVAL_MS);
  }
};
