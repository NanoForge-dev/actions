import { info, setFailed, setOutput } from "@actions/core";
import process from "node:process";
import { join } from "path";

import {
  checkoutBranch,
  commitAll,
  commitMessages,
  lastCommitChanging,
  push,
  tagExists,
} from "../lib/git";
import { createPullRequest } from "../lib/github";
import { getBoolean, getString } from "../lib/inputs";
import { nfRegistryVersions } from "../lib/registry";
import { writeSummary } from "../lib/summary";
import { highestBump } from "../lib/version";
import { repoRelative } from "../lib/workspace";
import {
  MANIFEST_FILE_NAME,
  type NfPackage,
  listNfPackages,
  nfTag,
  setManifestVersion,
} from "../nf-registry-release/packages";
import { type NfVersionPlan, planNfVersion } from "./plan";

/**
 * Commits of `pkg` since its last registry release: its tag, else the last commit that changed the manifest
 * version (a release made before the tags), else the whole history.
 */
const commitsSinceRelease = async (pkg: NfPackage): Promise<string[]> => {
  const dir = repoRelative(pkg.path);
  const tag = pkg.version ? nfTag(pkg.name, pkg.version) : undefined;
  const since =
    tag && (await tagExists(tag))
      ? tag
      : await lastCommitChanging(join(dir, MANIFEST_FILE_NAME), '"version"');
  return commitMessages(since, [dir]);
};

const main = async () => {
  const dry = getBoolean("dry-run", false);
  const pkgs = listNfPackages(getString("path", "packages"));

  const plans: (NfVersionPlan & { pkg: NfPackage })[] = [];
  const unchanged: string[] = [];
  for (const pkg of pkgs) {
    const plan = planNfVersion(
      pkg.version,
      await nfRegistryVersions(pkg.name),
      highestBump(await commitsSinceRelease(pkg)),
    );
    if (plan) plans.push({ ...plan, pkg });
    else unchanged.push(`\`${pkg.name}@${pkg.version}\``);
  }

  const lines = plans.map(
    ({ pkg, version, reason }) =>
      `\`${pkg.name}\`: ${pkg.version || "none"} → ${version} (${reason})`,
  );
  const toEdit = plans.filter(({ changed }) => changed);
  const list = toEdit.map(({ pkg, version }) => `${pkg.name}@${version}`).join(", ");
  const branch = `nf-releases/${process.env.GITHUB_RUN_ID ?? Date.now()}`;
  const message = `chore(registry): release ${list}`;

  let url = "";
  if (!toEdit.length) info("No package to bump");
  else if (dry) info(`[DRY] Would push "${branch}" and open the PR "${message}"`);
  else {
    await checkoutBranch(branch);
    for (const { pkg, version } of toEdit) setManifestVersion(pkg, version);
    if (!(await commitAll(message)))
      throw new Error("Nothing changed: the versions are already set");
    await push(".", branch, process.env.GITHUB_TOKEN);
    url = await createPullRequest(
      branch,
      message,
      `NanoForge registry release. Merging it publishes every package newer than the registry:\n\n${lines.map((line) => `- ${line}`).join("\n")}\n`,
    );
    info(`Opened ${url}`);
  }

  setOutput("pull-request", url);
  setOutput(
    "packages",
    JSON.stringify(plans.map(({ pkg, version }) => ({ name: pkg.name, version }))),
  );
  await writeSummary(`NanoForge registry release PR${list ? `: ${list}` : ""}`, dry, [
    ["To release", lines],
    ["Unchanged", unchanged],
    ["Pull request", url ? [url] : []],
  ]);
};

main().catch((error: unknown) => setFailed(error instanceof Error ? error.message : String(error)));
