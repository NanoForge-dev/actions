import { endGroup, info, setFailed, setOutput, startGroup } from "@actions/core";
import { $ } from "bun";
import { join } from "path";
import semver from "semver";

import { readPackageChangelog, readRootChangelog } from "../lib/changelog";
import { type ReleaseGroup, groupOf, loadConfig } from "../lib/config";
import { formatString } from "../lib/format";
import { assertCommit, headSha, showFile } from "../lib/git";
import { createRelease, createTag, moveTag } from "../lib/github";
import { getBoolean, getString } from "../lib/inputs";
import { isOnNpm, waitUntil } from "../lib/registry";
import { sortReleaseTree } from "../lib/release-tree";
import { writeSummary } from "../lib/summary";
import { type WorkspacePackage, listWorkspace, repoRelative, rootPath } from "../lib/workspace";

interface Released {
  pkg: WorkspacePackage;
  group: ReleaseGroup;
}

interface Tagged {
  tag: string;
  version: string;
  changelog?: string;
  group: ReleaseGroup;
}

/** Packages of the config whose package.json version changed since `base` (the merged commit's parent). */
const findReleased = async (
  workspace: WorkspacePackage[],
  groups: (pkg: string) => ReleaseGroup | undefined,
): Promise<Released[]> => {
  const released: Released[] = [];
  const base = getString("base", "HEAD^1");
  await assertCommit(base);
  for (const pkg of workspace) {
    const group = groups(pkg.name);
    if (!group) continue;
    const before = await showFile(base, join(repoRelative(pkg.path), "package.json"));
    const previous = before ? (JSON.parse(before) as { version?: string }).version : undefined;
    if (previous !== pkg.version) released.push({ pkg, group });
  }
  return released;
};

const publishToNpm = async (released: Released[], dry: boolean) => {
  const published: string[] = [];
  const skipped: string[] = [];
  const toPublish = released.filter(({ pkg, group }) => {
    const id = `${pkg.name}@${pkg.version}`;
    if (group.npm && !pkg.private) return true;
    skipped.push(`\`${id}\` (${pkg.private ? "private" : "npm disabled"})`);
    return false;
  });

  const tree = sortReleaseTree(toPublish.map(({ pkg }) => pkg));
  for (const [index, batch] of tree.entries()) {
    // Only a later batch needs the packages to be visible on npm.
    const wait = index < tree.length - 1;
    startGroup(`Publishing ${batch.map((pkg) => `${pkg.name}@${pkg.version}`).join(", ")}`);
    await Promise.all(
      batch.map(async (pkg) => {
        const id = `${pkg.name}@${pkg.version}`;
        if (await isOnNpm(pkg.name, pkg.version)) {
          info(`${id} is already published, skipping`);
          skipped.push(`\`${id}\` (already published)`);
          return;
        }
        if (dry) info(`[DRY] Would publish ${id}`);
        else {
          await $`pnpm --filter=${pkg.name} publish --provenance --no-git-checks`;
          if (wait) await waitUntil(`${id} on npm`, () => isOnNpm(pkg.name, pkg.version));
        }
        published.push(`\`${id}\``);
      }),
    );
    endGroup();
  }
  return { published, skipped };
};

const planTags = async (released: Released[]): Promise<Tagged[]> => {
  const tagged: Tagged[] = [];
  const groups = [...new Set(released.map(({ group }) => group))];

  for (const group of groups) {
    const pkgs = released.filter((entry) => entry.group === group).map(({ pkg }) => pkg);
    if (group.versioning === "independent") {
      for (const pkg of pkgs)
        tagged.push({
          group,
          version: pkg.version,
          tag: formatString(group.tagFormat, {
            name: group.name,
            package: pkg.name,
            version: pkg.version,
            packages: `${pkg.name}@${pkg.version}`,
            run: "",
          }),
          changelog: await readPackageChangelog(pkg.path, pkg.name, pkg.version),
        });
      continue;
    }

    const versions = [...new Set(pkgs.map((pkg) => pkg.version))];
    if (versions.length !== 1)
      throw new Error(
        `Group "${group.name}" is shared but released several versions: ${versions.join(", ")}`,
      );
    const version = versions[0] as string;
    const only = pkgs.length === 1 ? pkgs[0] : undefined;
    tagged.push({
      group,
      version,
      tag: formatString(group.tagFormat, {
        name: group.name,
        package: only?.name,
        version,
        packages: pkgs.map((pkg) => `${pkg.name}@${version}`).join(", "),
        run: "",
      }),
      changelog: only
        ? await readPackageChangelog(only.path, only.name, version)
        : await readRootChangelog(rootPath(), version),
    });
  }
  return tagged;
};

const createTags = async (tagged: Tagged[], dry: boolean): Promise<void> => {
  const sha = await headSha();
  for (const { tag, version, changelog, group } of tagged) {
    const major = `v${semver.major(version)}`;
    if (dry) {
      info(
        `[DRY] Would create ${group.githubRelease ? "the release" : "the tag"} "${tag}"${group.majorTag ? ` and move "${major}"` : ""}`,
      );
      continue;
    }
    if (group.githubRelease) await createRelease(tag, sha, changelog, group.latest);
    else await createTag(tag, sha);
    if (group.majorTag) await moveTag(major, sha);
  }
};

const main = async () => {
  const dry = getBoolean("dry-run", false);
  const config = await loadConfig(rootPath(), getString("config"));
  const released = await findReleased(await listWorkspace(), (pkg) => groupOf(config, pkg));

  setOutput("released", released.length ? "true" : "false");
  if (!released.length) {
    info("No package of the config changed version in this commit: nothing to release");
    await writeSummary("Release", dry, [["Tags", []]]);
    return;
  }

  // Plan the tags first: a format error must stop the release before anything reaches npm.
  const tagged = await planTags(released);
  const { published, skipped } = await publishToNpm(released, dry);
  await createTags(tagged, dry);

  const first = tagged[0] as Tagged;
  // Docs follow the releases of one group only (docs.group), with that group's version.
  const docs = tagged.find(({ group }) => group.name === config.docs?.group);
  setOutput("docs-version", docs?.version ?? "");
  setOutput("version", first.version);
  setOutput("tag", first.tag);
  setOutput("tags", JSON.stringify(tagged.map(({ tag }) => tag)));
  setOutput(
    "packages",
    JSON.stringify(released.map(({ pkg }) => ({ name: pkg.name, version: pkg.version }))),
  );

  await writeSummary(`Release ${tagged.map(({ tag }) => tag).join(", ")}`, dry, [
    ["Tags", tagged.map(({ tag }) => `\`${tag}\``)],
    ["Published on npm", published],
    ["Not published on npm", skipped],
  ]);
};

main().catch((error: unknown) => setFailed(error instanceof Error ? error.message : String(error)));
