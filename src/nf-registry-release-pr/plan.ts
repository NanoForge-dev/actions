import { isNewerThan } from "../lib/registry";
import { type Bump, bumpVersion, highestVersion } from "../lib/version";

export const FIRST_VERSION = "1.0.0";

export interface NfVersionPlan {
  version: string;
  reason: string;
  /** The manifest must be edited */
  changed: boolean;
}

/**
 * Next registry version of a package, from its manifest version, the versions on the registry, the bump its
 * commits ask for since its last release and whether the manifest version was released before (its git tag
 * exists). Undefined: nothing to release.
 */
export const planNfVersion = (
  manifest: string,
  published: string[],
  bump: Bump | undefined,
  tagged = false,
): NfVersionPlan | undefined => {
  if (!manifest && !published.length)
    return { version: FIRST_VERSION, reason: "first release", changed: true };
  if (manifest && !tagged && isNewerThan(manifest, published))
    return { version: manifest, reason: "not on the registry yet", changed: false };

  // Bump the highest known version: a lower manifest version would collide with a published one.
  const base = highestVersion([manifest, ...published].filter(Boolean));
  if (bump) return { version: bumpVersion(base, bump), reason: `${bump} bump`, changed: true };
  if (!manifest) return { version: base, reason: "version from the registry", changed: true };
  // Tagged but gone from the registry: it was unpublished, and the registry never takes a number twice (409).
  if (tagged && !published.includes(manifest))
    return { version: bumpVersion(base, "patch"), reason: "version used before", changed: true };
  return undefined;
};
