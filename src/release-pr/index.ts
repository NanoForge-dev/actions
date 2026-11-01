import { info, setFailed, setOutput } from "@actions/core";
import process from "node:process";

import { type ReleaseGroup, loadConfig, selectGroup, selectPackages } from "../lib/config";
import { formatString } from "../lib/format";
import { checkoutBranch, commitAll, push } from "../lib/git";
import { createPullRequest } from "../lib/github";
import { getBoolean, getList, getString } from "../lib/inputs";
import { runPackageChangelog, updateRootChangelog } from "../lib/root-changelog";
import { writeSummary } from "../lib/summary";
import {
  NothingToReleaseError,
  assertVersion,
  highestVersion,
  resolveNextVersion,
} from "../lib/version";
import {
  type WorkspacePackage,
  findPackages,
  listWorkspace,
  repoRelative,
  rootPath,
  setVersion,
} from "../lib/workspace";

interface PlannedRelease {
  pkg: WorkspacePackage;
  version: string;
  reason: string;
}

const planShared = async (
  group: ReleaseGroup,
  pkgs: WorkspacePackage[],
  groupPkgs: WorkspacePackage[],
  forced: string,
): Promise<PlannedRelease[]> => {
  if (forced) return pkgs.map((pkg) => ({ pkg, version: forced, reason: "given version" }));
  // The whole group shares one version line: start from its highest version, so releasing a subset
  // never reuses a version (and a tag) another subset already took.
  const current = highestVersion(groupPkgs.map((pkg) => pkg.version));
  const { version, bump, since } = await resolveNextVersion(
    current,
    {
      format: group.tagFormat,
      name: group.name,
      package: pkgs.length === 1 ? pkgs[0]?.name : undefined,
    },
    pkgs.map((pkg) => repoRelative(pkg.path)),
  );
  const reason = `${bump} bump since ${since ?? "the first commit"}`;
  return pkgs.map((pkg) => ({ pkg, version, reason }));
};

const planIndependent = async (
  group: ReleaseGroup,
  pkgs: WorkspacePackage[],
  forced: string,
): Promise<PlannedRelease[]> => {
  const plans: PlannedRelease[] = [];
  for (const pkg of pkgs) {
    if (forced) {
      plans.push({ pkg, version: forced, reason: "given version" });
      continue;
    }
    try {
      const { version, bump, since } = await resolveNextVersion(
        pkg.version,
        { format: group.tagFormat, name: group.name, package: pkg.name },
        [repoRelative(pkg.path)],
      );
      plans.push({ pkg, version, reason: `${bump} bump since ${since ?? "the first commit"}` });
    } catch (error) {
      if (!(error instanceof NothingToReleaseError)) throw error;
      info(`Skipping ${pkg.name}: ${error.message}`);
    }
  }
  if (!plans.length)
    throw new Error(
      "No selected package has a feat, fix or breaking commit: give a version to release anyway",
    );
  return plans;
};

const applyVersions = async (group: ReleaseGroup, plans: PlannedRelease[]): Promise<void> => {
  for (const { pkg, version } of plans) {
    await setVersion(pkg.path, version);
    await runPackageChangelog(pkg.name);
  }

  // A shared release of several packages also bumps the root package and its merged changelog.
  const root = rootPath();
  const version = plans[0]?.version as string;
  if (
    group.versioning !== "shared" ||
    plans.length < 2 ||
    plans.some(({ pkg }) => pkg.path === root)
  )
    return;
  try {
    await setVersion(root, version);
  } catch {
    info("No root package.json, skipping the root version");
  }
  try {
    await updateRootChangelog(
      root,
      plans.map(({ pkg }) => pkg),
      version,
    );
  } catch (error) {
    info(`Failed to update the root changelog: ${error}`);
  }
};

const main = async () => {
  const dry = getBoolean("dry-run", false);
  const config = await loadConfig(rootPath(), getString("config"));
  const group = selectGroup(config, getString("group"));
  const forced = getString("version") && assertVersion(getString("version"));

  const workspace = await listWorkspace();
  const pkgs = findPackages(workspace, selectPackages(group, getList("packages")));
  const plans =
    group.versioning === "shared"
      ? await planShared(group, pkgs, findPackages(workspace, group.packages), forced)
      : await planIndependent(group, pkgs, forced);

  const versions = new Set(plans.map((plan) => plan.version));
  const tokens = {
    name: group.name,
    package: plans.length === 1 ? plans[0]?.pkg.name : undefined,
    version: versions.size === 1 ? [...versions][0] : undefined,
    packages: plans.map(({ pkg, version }) => `${pkg.name}@${version}`).join(", "),
    run: process.env.GITHUB_RUN_ID ?? String(Date.now()),
  };
  const branch = formatString(group.branchFormat, tokens);
  const message = formatString(group.commitFormat, tokens);
  const lines = plans.map(
    ({ pkg, version, reason }) => `\`${pkg.name}\`: ${pkg.version} → ${version} (${reason})`,
  );

  await checkoutBranch(branch);
  await applyVersions(group, plans);

  let url = "";
  if (dry) {
    info(`[DRY] Would push "${branch}" and open the PR "${message}"`);
  } else {
    if (!(await commitAll(message)))
      throw new Error("Nothing changed: the versions are already set");
    await push(".", branch, process.env.GITHUB_TOKEN);
    url = await createPullRequest(
      branch,
      message,
      `Release of group \`${group.name}\`:\n\n${lines.map((line) => `- ${line}`).join("\n")}\n`,
    );
    info(`Opened ${url}`);
  }

  setOutput("branch", branch);
  setOutput("version", tokens.version ?? "");
  setOutput("pull-request", url);
  await writeSummary("Release PR", dry, [
    ["Packages", lines],
    ["Branch", [`\`${branch}\``]],
    ["Commit", [`\`${message}\``]],
  ]);
};

main().catch((error: unknown) => setFailed(error instanceof Error ? error.message : String(error)));
