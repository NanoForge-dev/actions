import { getInput, info, summary } from "@actions/core";
import { program } from "commander";

import {
  type IPkg,
  extractTokens,
  formatString,
  resolvePackage,
  resolveRootPath,
  safeGetBooleanInput,
  updateVersion,
} from "../../lib";
import { runPackageChangelog, updateRootChangelog } from "./changelog";
import { checkoutToReleaseBranch, commitAndPush } from "./git";
import { createPR } from "./github";

const parseOptions = () => {
  program
    .name("create packages release pr")
    .description("Creates a release PR for multiple packages at a shared version")
    .option(
      "--dry",
      "skips PR creation and outputs logs instead",
      safeGetBooleanInput("dry", false),
    )
    .option("--packages <packages>", "comma-separated list of package names", getInput("packages"))
    .option("--version <version>", "version to release", getInput("version"))
    .option(
      "--branch-format <format>",
      "branch name format ({org}, {package}, {version})",
      getInput("branch_format") || "releases/{package}@{version}",
    )
    .option(
      "--commit-format <format>",
      "commit message format ({org}, {package}, {version})",
      getInput("commit_format") || "chore({package}): release {org}/{package}@{version}",
    )
    .parse();

  return program.opts<{
    dry: boolean;
    packages: string;
    version: string;
    branchFormat: string;
    commitFormat: string;
  }>();
};

const updatePackages = async (pkgs: IPkg[], rootPath: string, version: string): Promise<void> => {
  for (const pkg of pkgs) {
    await updateVersion(pkg.path, version);
    await runPackageChangelog(pkg.name);
  }

  if (pkgs.length > 1 && !pkgs.some((p) => p.path === rootPath)) {
    try {
      await updateVersion(rootPath, version);
    } catch {
      info("Root package.json not found, skipping root version update");
    }

    try {
      await updateRootChangelog(rootPath, pkgs, version);
    } catch (error) {
      info(`Failed to update root changelog: ${error}`);
    }
  }
};

const writeSummary = async (
  pkgs: IPkg[],
  version: string,
  branchName: string,
  commitMessage: string,
  dry: boolean,
): Promise<void> => {
  const result = summary.addHeading("Pre-Release summary");
  if (dry) result.addRaw("\n\n> [!NOTE]\n> This is a dry run.\n\n");

  result.addHeading("Packages", 2);
  result.addRaw("\n");
  for (const pkg of pkgs) result.addRaw(`- \`${pkg.name}@${version}\`\n`);
  result.addRaw("\n");

  result.addHeading("Branch", 2);
  result.addRaw(`\n\`${branchName}\`\n\n`);

  result.addHeading("Commit", 2);
  result.addRaw(`\n\`${commitMessage}\`\n\n`);

  await result.write();
};

const bootstrap = async () => {
  const { dry, packages: packagesInput, version, branchFormat, commitFormat } = parseOptions();

  const packageNames = packagesInput
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (!packageNames.length) throw new Error("No packages specified");
  if (!version) throw new Error("No version specified");

  if (branchFormat.includes("{package}") && packageNames.length > 1)
    throw new Error(
      "{package} token cannot be used in branch-format when releasing multiple packages",
    );
  if (commitFormat.includes("{package}") && packageNames.length > 1)
    throw new Error(
      "{package} token cannot be used in commit-format when releasing multiple packages",
    );

  const pkgs = (await Promise.all(packageNames.map(resolvePackage))) as [IPkg, ...IPkg[]];
  const tokens = extractTokens(packageNames, version);
  const branchName = formatString(branchFormat, tokens);
  const commitMessage = formatString(commitFormat, tokens);

  await checkoutToReleaseBranch(branchName);
  await updatePackages(pkgs, resolveRootPath(), version);

  if (dry) {
    info(`[DRY] Would create branch "${branchName}" with commit: "${commitMessage}"`);
    info(`[DRY] Packages: ${pkgs.map((p) => `${p.name}@${version}`).join(", ")}`);
  } else {
    await commitAndPush(branchName, commitMessage);
    await createPR(branchName, commitMessage);
  }

  await writeSummary(pkgs, version, branchName, commitMessage, dry);
};

void bootstrap();
