import semver from "semver";

import { formatString } from "./format";
import { commitMessages, tagExists } from "./git";

export type Bump = "major" | "minor" | "patch";

const ORDER: Bump[] = ["patch", "minor", "major"];
const HEADER = /^(?<type>\w+)(?:\([^)]*\))?(?<breaking>!)?: /;

/** Conventional commit → bump: breaking → major, feat → minor, fix/perf → patch, others → none. */
export const commitBump = (message: string): Bump | undefined => {
  const match = HEADER.exec(message);
  if (!match?.groups) return undefined;
  if (match.groups.breaking || /^BREAKING[ -]CHANGE: /m.test(message)) return "major";
  if (match.groups.type === "feat") return "minor";
  if (match.groups.type === "fix" || match.groups.type === "perf") return "patch";
  return undefined;
};

export const highestBump = (messages: string[]): Bump | undefined =>
  messages
    .map(commitBump)
    .reduce<
      Bump | undefined
    >((max, bump) => (bump && (!max || ORDER.indexOf(bump) > ORDER.indexOf(max)) ? bump : max), undefined);

export const bumpVersion = (version: string, bump: Bump): string => {
  const next = semver.inc(version, bump);
  if (!next) throw new Error(`Invalid semver version: ${version}`);
  return next;
};

export const highestVersion = (versions: string[]): string =>
  versions.reduce((max, version) => (semver.gt(version, max) ? version : max));

export const assertVersion = (version: string): string => {
  if (!semver.valid(version)) throw new Error(`"${version}" is not a valid semver version`);
  return version;
};

/**
 * Next version from the commits since the tag of `current` (all history if that tag is missing),
 * limited to `paths`. Throws when no commit asks for a release.
 */
export const resolveNextVersion = async (
  current: string,
  tag: { format: string; name: string; package?: string },
  paths: string[],
): Promise<{ version: string; bump: Bump; since?: string }> => {
  const tagName = formatString(tag.format, {
    name: tag.name,
    package: tag.package,
    version: current,
    packages: "",
    run: "",
  });
  const since = (await tagExists(tagName)) ? tagName : undefined;
  const bump = highestBump(await commitMessages(since, paths));
  if (!bump)
    throw new Error(
      `No feat, fix or breaking commit since ${since ?? "the first commit"} in ${paths.join(", ")}: give a version to release anyway`,
    );
  return { version: bumpVersion(current, bump), bump, since };
};
