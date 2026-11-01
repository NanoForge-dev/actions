import semver from "semver";

export interface Version {
  version: string;
  deprecated?: string;
}

interface DevRelease {
  newVersion: string;
  toDeprecate: string[];
}

const resolveNextBase = (currentVersion: string): string => {
  const parsed = semver.parse(currentVersion);
  if (!parsed) throw new Error(`Invalid semver version: ${currentVersion}`);
  const stable = `${parsed.major}.${parsed.minor}.${parsed.patch}`;
  return parsed.prerelease.length > 0 ? stable : (semver.inc(stable, "patch") as string);
};

const sanitizeBranch = (branch: string): string => {
  const args = branch.split("/");
  if (args.length > 1) branch = args.slice(1).join("-");
  return branch
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
};

export const fetchDevVersions = async (pkgName: string, tag: string): Promise<Version[]> => {
  try {
    const res = await fetch(`https://registry.npmjs.org/${pkgName}`);
    if (!res.ok) return [];
    const data = (await res.json()) as { versions: Record<string, Version> };
    return Object.values(data.versions).filter((v) => semver.prerelease(v.version)?.[0] === tag);
  } catch {
    return [];
  }
};

export const resolveAlphaRelease = (
  currentVersion: string,
  branchName: string,
  existingAlphas: Version[],
): DevRelease => {
  const nextBase = resolveNextBase(currentVersion);
  const branchSlug = sanitizeBranch(branchName);
  const prefix = `${nextBase}-alpha.${branchSlug}.`;

  const seen = new Set([...existingAlphas.filter((v) => v.version.startsWith(prefix))]);
  if (currentVersion.startsWith(prefix)) seen.add({ version: currentVersion });
  const branchAlphas = [...seen];

  const maxN = branchAlphas.reduce((max, v) => {
    const n = parseInt(v.version.slice(prefix.length), 10);
    return isNaN(n) ? max : Math.max(max, n);
  }, -1);

  const newVersion = `${prefix}${maxN + 1}`;
  const toDeprecate = branchAlphas
    .filter((v) => v.version !== newVersion && !v.deprecated)
    .map(({ version }) => version);

  return { newVersion, toDeprecate };
};

export const resolveBetaRelease = (
  currentVersion: string,
  commitSha: string,
  existingBetas: Version[],
): DevRelease => {
  const nextBase = resolveNextBase(currentVersion);
  const newVersion = `${nextBase}-beta.${commitSha.slice(0, 7)}`;
  const toDeprecate = existingBetas
    .filter((v) => v.version !== newVersion && !v.deprecated)
    .map(({ version }) => version);

  return { newVersion, toDeprecate };
};
