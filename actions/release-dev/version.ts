import semver from "semver";

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

export const fetchDevVersions = async (pkgName: string, tag: string): Promise<string[]> => {
  try {
    const res = await fetch(`https://registry.npmjs.org/${pkgName}`);
    if (!res.ok) return [];
    const data = (await res.json()) as { versions: Record<string, unknown> };
    return Object.keys(data.versions).filter((v) => semver.prerelease(v)?.[0] === tag);
  } catch {
    return [];
  }
};

export const resolveAlphaRelease = (
  currentVersion: string,
  branchName: string,
  existingAlphas: string[],
): DevRelease => {
  const nextBase = resolveNextBase(currentVersion);
  const branchSlug = sanitizeBranch(branchName);
  const prefix = `${nextBase}-alpha.${branchSlug}.`;

  const seen = new Set([...existingAlphas.filter((v) => v.startsWith(prefix))]);
  if (currentVersion.startsWith(prefix)) seen.add(currentVersion);
  const branchAlphas = [...seen];

  const maxN = branchAlphas.reduce((max, v) => {
    const n = parseInt(v.slice(prefix.length), 10);
    return isNaN(n) ? max : Math.max(max, n);
  }, -1);

  const newVersion = `${prefix}${maxN + 1}`;
  const toDeprecate = branchAlphas.filter((v) => v !== newVersion);

  return { newVersion, toDeprecate };
};

export const resolveBetaRelease = (
  currentVersion: string,
  commitSha: string,
  existingBetas: string[],
): DevRelease => {
  const nextBase = resolveNextBase(currentVersion);
  const newVersion = `${nextBase}-beta.${commitSha.slice(0, 7)}`;
  const toDeprecate = existingBetas.filter((v) => v !== newVersion);

  return { newVersion, toDeprecate };
};
