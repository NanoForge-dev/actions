import { getInput, info, summary } from "@actions/core";
import { program } from "commander";
import process from "node:process";

import { resolvePackage, safeGetBooleanInput, updateVersion } from "../../lib";
import { commitAndPush } from "./git";
import { deprecateOldDevVersions, publishDev } from "./npm";
import { fetchDevVersions, resolveAlphaRelease, resolveBetaRelease } from "./version";

const parseOptions = () => {
  program
    .name("release dev")
    .description("Releases a package as a pre-release version on npm")
    .option(
      "--dry",
      "skips publishing and deprecation, outputs logs instead",
      safeGetBooleanInput("dry", false),
    )
    .option("--package <package>", "published name of the package to release", getInput("package"))
    .option(
      "--tag <tag>",
      "pre-release tag to publish under (alpha or beta)",
      getInput("tag") || "alpha",
    )
    .parse();

  return program.opts<{ dry: boolean; package: string; tag: string }>();
};

const resolveRelease = (currentVersion: string, tag: string, existingVersions: string[]) => {
  if (tag === "alpha") {
    const branch = process.env.GITHUB_REF_NAME ?? "";
    if (!branch) throw new Error("GITHUB_REF_NAME is required for alpha releases");
    return resolveAlphaRelease(currentVersion, branch, existingVersions);
  }

  if (tag === "beta") {
    const commitSha = process.env.GITHUB_SHA ?? "";
    if (!commitSha) throw new Error("GITHUB_SHA is required for beta releases");
    return resolveBetaRelease(currentVersion, commitSha, existingVersions);
  }

  throw new Error(`Unsupported tag "${tag}". Supported values: alpha, beta`);
};

const writeSummary = async (
  pkgName: string,
  newVersion: string,
  tag: string,
  toDeprecate: string[],
  dry: boolean,
): Promise<void> => {
  const result = summary.addHeading("Dev Release summary");
  if (dry) result.addRaw("\n\n> [!NOTE]\n> This is a dry run.\n\n");

  result.addHeading("Published", 2);
  result.addRaw(`\n\`${pkgName}@${newVersion}\` (tag: \`${tag}\`)\n\n`);

  if (toDeprecate.length) {
    result.addHeading("Deprecated", 2);
    result.addRaw("\n");
    for (const v of toDeprecate) result.addRaw(`- \`${pkgName}@${v}\`\n`);
    result.addRaw("\n");
  }

  await result.write();
};

const DEFAULT_BRANCHES = new Set(["main", "master"]);

const bootstrap = async () => {
  const { dry, package: pkgName, tag } = parseOptions();
  if (!pkgName) throw new Error("No package specified");

  const branch = process.env.GITHUB_REF_NAME ?? "";
  const isDefaultBranch = DEFAULT_BRANCHES.has(branch);

  const pkg = await resolvePackage(pkgName);
  const existingVersions = await fetchDevVersions(pkgName, tag);
  const { newVersion, toDeprecate } = resolveRelease(pkg.version, tag, existingVersions);

  info(`Resolved next ${tag}: ${pkgName}@${newVersion}`);
  if (toDeprecate.length)
    info(`Found ${toDeprecate.length} existing ${tag}(s) — older ones will be deprecated`);
  if (isDefaultBranch) info(`Running on default branch — version bump will not be committed`);

  await updateVersion(pkg.path, newVersion);

  if (dry) {
    const commitNote = isDefaultBranch ? "skip commit (default branch)" : `commit and push`;
    info(
      `[DRY] Would ${commitNote}, publish ${pkgName}@${newVersion}, and deprecate: ${toDeprecate.join(", ") || "none"}`,
    );
  } else {
    if (!isDefaultBranch) await commitAndPush(pkgName, newVersion, tag);
    await publishDev(pkgName, newVersion, tag, dry);
    await deprecateOldDevVersions(pkgName, toDeprecate, newVersion, dry);
  }

  await writeSummary(pkgName, newVersion, tag, toDeprecate, dry);
};

void bootstrap();
