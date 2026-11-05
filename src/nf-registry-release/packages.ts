import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "path";
import semver from "semver";

import { type TreeNode, withDependencies } from "../lib/release-tree";

export const MANIFEST_FILE_NAME = "nanoforge.manifest.json";

export interface NfPackage extends TreeNode {
  path: string;
  /** Version of the manifest, empty when it has none yet */
  version: string;
}

interface Manifest {
  name?: string;
  version?: string;
  dependencies?: string[] | Record<string, string>;
}

/** The registry takes `["@scope/name"]` or `{ "@scope/name": "<range>" }`. */
const dependencyNames = (deps: Manifest["dependencies"]): string[] =>
  Array.isArray(deps) ? deps : Object.keys(deps ?? {});

export const listNfPackages = (dir: string): NfPackage[] =>
  readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name === MANIFEST_FILE_NAME &&
        !entry.parentPath.split(/[\\/]/).includes("node_modules"),
    )
    .map((entry) => {
      const manifest = JSON.parse(
        readFileSync(join(entry.parentPath, entry.name), "utf-8"),
      ) as Manifest;
      return {
        name: manifest.name ?? "",
        version: manifest.version ?? "",
        path: entry.parentPath,
        dependsOn: dependencyNames(manifest.dependencies),
      };
    })
    .filter((pkg) => pkg.name);

/**
 * Sets `"version"` in the manifest of `pkg`, editing only that line (after `"name"` when it has none), so the
 * file keeps the repo's formatting.
 */
export const setManifestVersion = (pkg: NfPackage, version: string): void => {
  const file = join(pkg.path, MANIFEST_FILE_NAME);
  const content = readFileSync(file, "utf-8");
  const value = JSON.stringify(version);
  const next = /"version"\s*:\s*"[^"]*"/.test(content)
    ? content.replace(/"version"\s*:\s*"[^"]*"/, `"version": ${value}`)
    : content.replace(
        /^([ \t]*)("name"\s*:\s*"[^"]*")(,?)/m,
        (_, indent: string, name: string, comma: string) =>
          `${indent}${name},\n${indent}"version": ${value}${comma}`,
      );
  if (next === content) throw new Error(`Couldn't set the version in ${file}`);
  if ((JSON.parse(next) as Manifest).version !== version)
    throw new Error(`Setting the version broke ${file}`);
  writeFileSync(file, next);
};

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

/** Git tag of a registry release, which the next release PR counts the commits from. */
export const nfTag = (name: string, version: string): string => `${name}@${version}`;

/** The registry's package names (api registry.const.ts): @scope/name, lowercase letters, digits and -. */
const NF_NAME = /^@[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9-]*$/;

/**
 * Checks every manifest against the registry rules before any request, publish or tag, and lists every bad one
 * at once. A manifest may have no version yet: the release PR gives it one.
 */
export const assertNfPackages = (pkgs: NfPackage[]): NfPackage[] => {
  const bad = pkgs.flatMap((pkg) => [
    ...(NF_NAME.test(pkg.name) ? [] : [`${pkg.path}: name "${pkg.name}" is not @scope/name`]),
    ...(!pkg.version || semver.valid(pkg.version) === pkg.version
      ? []
      : [`${pkg.path}: version "${pkg.version}" is not semver`]),
    ...pkg.dependsOn
      .filter((dep) => !NF_NAME.test(dep))
      .map((dep) => `${pkg.path}: dependency "${dep}" is not @scope/name`),
  ]);
  if (bad.length) throw new Error(`Invalid ${MANIFEST_FILE_NAME}:\n${bad.join("\n")}`);
  return pkgs;
};
