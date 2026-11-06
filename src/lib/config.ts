import { file } from "bun";
import { join } from "path";

export const CONFIG_PATH = ".github/nanoforge.json";

export type ReleaseMode = "all" | "single" | "some";
export type Versioning = "shared" | "independent";

export interface ReleaseGroup {
  name: string;
  packages: string[];
  /** all: every package at once; single: exactly one; some: any subset (default all) */
  mode: ReleaseMode;
  /** shared: one version and one tag for the release; independent: one per package */
  versioning: Versioning;
  npm: boolean;
  githubRelease: boolean;
  latest: boolean;
  tagFormat: string;
  branchFormat: string;
  commitFormat: string;
  /** Also move the `v<major>` tag (for actions consumed with `@v3`) */
  majorTag: boolean;
  /** Publish a beta on npm when a non-release PR is merged */
  betaOnMerge: boolean;
}

export interface DocsConfig {
  /** Group whose releases publish the docs (default: the first group) */
  group: string;
  category: string;
  references: boolean;
  referencesPath: string;
}

export interface NanoforgeConfig {
  groups: ReleaseGroup[];
  docs?: DocsConfig;
}

type Raw = Record<string, unknown>;

const isObject = (value: unknown): value is Raw =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const read = <T>(
  obj: Raw,
  key: string,
  where: string,
  check: (value: unknown) => value is T,
  fallback?: T,
): T => {
  const value = obj[key];
  if (value === undefined && fallback !== undefined) return fallback;
  if (!check(value))
    throw new Error(`Invalid ${CONFIG_PATH}: ${where}.${key} is missing or invalid`);
  return value;
};

const isString = (value: unknown): value is string => typeof value === "string" && value !== "";
const isBoolean = (value: unknown): value is boolean => typeof value === "boolean";
const isStringList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.length > 0 && value.every(isString);
const isOneOf =
  <T extends string>(...values: T[]) =>
  (value: unknown): value is T =>
    values.includes(value as T);

const GROUP_KEYS = [
  "name",
  "packages",
  "mode",
  "versioning",
  "npm",
  "githubRelease",
  "latest",
  "tagFormat",
  "branchFormat",
  "commitFormat",
  "majorTag",
  "betaOnMerge",
];
const DOCS_KEYS = ["group", "category", "references", "referencesPath"];

/** Typos (`betaOnmerge`) would silently fall back to a default: refuse them. */
const assertKnownKeys = (obj: Raw, keys: string[], where: string) => {
  const unknown = Object.keys(obj).filter((key) => !keys.includes(key));
  if (unknown.length)
    throw new Error(`Invalid ${CONFIG_PATH}: unknown key(s) in ${where}: ${unknown.join(", ")}`);
};

const parseGroup = (raw: unknown, index: number): ReleaseGroup => {
  const where = `groups[${index}]`;
  if (!isObject(raw)) throw new Error(`Invalid ${CONFIG_PATH}: ${where} must be an object`);
  assertKnownKeys(raw, GROUP_KEYS, where);
  const versioning = read(raw, "versioning", where, isOneOf("shared", "independent"), "shared");
  const shared = versioning === "shared";
  const group: ReleaseGroup = {
    name: read(raw, "name", where, isString),
    packages: read(raw, "packages", where, isStringList),
    mode: read(raw, "mode", where, isOneOf("all", "single", "some"), "all"),
    versioning,
    npm: read(raw, "npm", where, isBoolean, true),
    githubRelease: read(raw, "githubRelease", where, isBoolean, true),
    latest: read(raw, "latest", where, isBoolean, shared),
    tagFormat: read(
      raw,
      "tagFormat",
      where,
      isString,
      shared ? "{version}" : "{package}@{version}",
    ),
    branchFormat: read(
      raw,
      "branchFormat",
      where,
      isString,
      shared ? "releases/{name}@{version}" : "releases/{name}/{run}",
    ),
    commitFormat: read(
      raw,
      "commitFormat",
      where,
      isString,
      shared ? "chore({name}): release {name}@{version}" : "chore({name}): release {packages}",
    ),
    majorTag: read(raw, "majorTag", where, isBoolean, false),
    betaOnMerge: read(raw, "betaOnMerge", where, isBoolean, false),
  };
  // Tags are created after the npm publish: refuse formats that can't give one valid, distinct tag per release.
  const tag = group.tagFormat;
  if (!tag.includes("{version}"))
    throw new Error(`Invalid ${CONFIG_PATH}: ${where}.tagFormat must contain {version}`);
  if (/\{(packages|run)\}/.test(tag))
    throw new Error(`Invalid ${CONFIG_PATH}: ${where}.tagFormat can't use {packages} or {run}`);
  if (!shared && !tag.includes("{package}"))
    throw new Error(
      `Invalid ${CONFIG_PATH}: ${where}.tagFormat must contain {package} (independent versioning)`,
    );
  if (shared && tag.includes("{package}") && group.mode !== "single" && group.packages.length > 1)
    throw new Error(
      `Invalid ${CONFIG_PATH}: ${where}.tagFormat can only use {package} in a shared group that releases one package (mode single)`,
    );
  // The release workflow only runs for merged releases/* branches.
  if (!group.branchFormat.startsWith("releases/"))
    throw new Error(`Invalid ${CONFIG_PATH}: ${where}.branchFormat must start with "releases/"`);
  return group;
};

export const parseConfig = (raw: unknown): NanoforgeConfig => {
  if (!isObject(raw)) throw new Error(`Invalid ${CONFIG_PATH}: must be an object`);
  assertKnownKeys(raw, ["$schema", "groups", "docs"], "the root");
  if (!Array.isArray(raw.groups) || !raw.groups.length)
    throw new Error(`Invalid ${CONFIG_PATH}: "groups" must be a non-empty list`);

  const groups = raw.groups.map(parseGroup);
  const seen = new Map<string, string>();
  for (const group of groups) {
    if (groups.filter((other) => other.name === group.name).length > 1)
      throw new Error(`Invalid ${CONFIG_PATH}: group "${group.name}" is defined twice`);
    for (const pkg of group.packages) {
      const owner = seen.get(pkg);
      if (owner)
        throw new Error(
          `Invalid ${CONFIG_PATH}: ${pkg} is in groups "${owner}" and "${group.name}"`,
        );
      seen.set(pkg, group.name);
    }
  }

  for (const group of groups) {
    const clash = groups.find(
      (other) =>
        other !== group &&
        other.tagFormat === group.tagFormat &&
        !/\{(name|package)\}/.test(group.tagFormat),
    );
    if (clash)
      throw new Error(
        `Invalid ${CONFIG_PATH}: groups "${group.name}" and "${clash.name}" share the tag format "${group.tagFormat}": add {name} to one of them`,
      );
  }

  if (raw.docs === undefined) return { groups };
  if (!isObject(raw.docs)) throw new Error(`Invalid ${CONFIG_PATH}: docs must be an object`);
  assertKnownKeys(raw.docs, DOCS_KEYS, "docs");
  const docsGroup = read(raw.docs, "group", "docs", isString, (groups[0] as ReleaseGroup).name);
  const docsOf = groups.find((group) => group.name === docsGroup);
  if (!docsOf) throw new Error(`Invalid ${CONFIG_PATH}: docs.group "${docsGroup}" is not a group`);
  // The docs are published under one version: the group must share it.
  if (docsOf.versioning !== "shared")
    throw new Error(`Invalid ${CONFIG_PATH}: docs.group "${docsGroup}" must use shared versioning`);
  return {
    groups,
    docs: {
      group: docsGroup,
      category: read(raw.docs, "category", "docs", isString),
      references: read(raw.docs, "references", "docs", isBoolean, false),
      referencesPath: read(raw.docs, "referencesPath", "docs", isString, "docs/references"),
    },
  };
};

/** `path` empty = the default .github/nanoforge.json */
export const loadConfig = async (root: string, path = ""): Promise<NanoforgeConfig> => {
  const fullPath = join(root, path || CONFIG_PATH);
  if (!(await file(fullPath).exists())) throw new Error(`No release config at ${fullPath}`);
  return parseConfig(await file(fullPath).json());
};

export const selectGroup = (config: NanoforgeConfig, name: string): ReleaseGroup => {
  if (!name) return config.groups[0] as ReleaseGroup;
  const group = config.groups.find((candidate) => candidate.name === name);
  if (!group)
    throw new Error(
      `Unknown group "${name}". Groups: ${config.groups.map((candidate) => candidate.name).join(", ")}`,
    );
  return group;
};

export const groupOf = (config: NanoforgeConfig, pkg: string): ReleaseGroup | undefined =>
  config.groups.find((group) => group.packages.includes(pkg));

/** Applies the group's mode to the packages asked at dispatch (empty = let the mode decide). */
export const selectPackages = (group: ReleaseGroup, requested: string[]): string[] => {
  const unknown = requested.filter((pkg) => !group.packages.includes(pkg));
  if (unknown.length)
    throw new Error(
      `Not in group "${group.name}": ${unknown.join(", ")}. Packages: ${group.packages.join(", ")}`,
    );

  switch (group.mode) {
    case "all":
      if (requested.length && requested.length !== group.packages.length)
        throw new Error(
          `Group "${group.name}" releases all its packages at once: leave "packages" empty`,
        );
      return group.packages;
    case "single":
      if (requested.length === 1) return requested;
      if (!requested.length && group.packages.length === 1) return group.packages;
      throw new Error(
        `Group "${group.name}" releases one package at a time: give exactly one in "packages"`,
      );
    case "some":
      return requested.length ? requested : group.packages;
  }
};
