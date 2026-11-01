import { info, setFailed, setOutput, warning } from "@actions/core";
import { $ } from "bun";
import process from "node:process";

import { type NanoforgeConfig, loadConfig } from "../lib/config";
import { commitAll, push } from "../lib/git";
import { defaultBranch } from "../lib/github";
import { getBoolean, getList, getString } from "../lib/inputs";
import { writeSummary } from "../lib/summary";
import { findPackages, listWorkspace, rootPath, setVersion } from "../lib/workspace";
import {
  type Version,
  fetchDevVersions,
  resolveAlphaRelease,
  resolveBetaRelease,
} from "./prerelease-version";

type Channel = "alpha" | "beta";

const requiredEnv = (name: string, channel: Channel): string => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for ${channel} releases`);
  return value;
};

const resolveRelease = (current: string, channel: Channel, existing: Version[]) =>
  channel === "alpha"
    ? resolveAlphaRelease(current, requiredEnv("GITHUB_REF_NAME", channel), existing)
    : resolveBetaRelease(current, requiredEnv("GITHUB_SHA", channel), existing);

/** Empty input: alpha needs the config to hold one package, beta takes every `betaOnMerge` group. */
const defaultPackages = (config: NanoforgeConfig, channel: Channel): string[] => {
  if (channel === "beta")
    return config.groups.filter((group) => group.betaOnMerge).flatMap((group) => group.packages);
  const all = config.groups.flatMap((group) => group.packages);
  if (all.length === 1) return all;
  throw new Error(`Give the package to release in "packages": ${all.join(", ")}`);
};

const main = async () => {
  const dry = getBoolean("dry-run", false);
  const channel = getString("channel", "alpha");
  if (channel !== "alpha" && channel !== "beta")
    throw new Error(`Unsupported channel "${channel}". Supported values: alpha, beta`);

  const config = await loadConfig(rootPath(), getString("config"));
  const known = config.groups.flatMap((group) => group.packages);
  const names = getList("packages").length ? getList("packages") : defaultPackages(config, channel);
  const unknown = names.filter((name) => !known.includes(name));
  if (unknown.length) throw new Error(`Not in the config: ${unknown.join(", ")}`);
  if (!names.length) {
    info("No package to pre-release");
    return;
  }

  const onDefaultBranch = process.env.GITHUB_REF_NAME === defaultBranch();
  const versions: string[] = [];
  const deprecated: string[] = [];

  const planned = [];
  for (const pkg of findPackages(await listWorkspace(), names)) {
    const { newVersion, toDeprecate } = resolveRelease(
      pkg.version,
      channel,
      await fetchDevVersions(pkg.name, channel),
    );
    info(`Resolved next ${channel}: ${pkg.name}@${newVersion}`);
    // Every version is set before any publish, so workspace: dependencies point at the new versions.
    await setVersion(pkg.path, newVersion);
    planned.push({ pkg, newVersion, toDeprecate });
  }

  for (const { pkg, newVersion, toDeprecate } of planned) {
    versions.push(`${pkg.name}@${newVersion}`);
    deprecated.push(...toDeprecate.map((version) => `\`${pkg.name}@${version}\``));

    if (dry) {
      info(
        `[DRY] Would publish ${pkg.name}@${newVersion} and deprecate: ${toDeprecate.join(", ") || "none"}`,
      );
      continue;
    }
    await $`pnpm --filter=${pkg.name} publish --provenance --no-git-checks --tag ${channel}`;
    for (const version of toDeprecate) {
      try {
        await $`npm deprecate ${`${pkg.name}@${version}`} ${`Superseded by ${pkg.name}@${newVersion}`}`;
      } catch (error) {
        warning(`Failed to deprecate ${pkg.name}@${version}: ${error}`);
      }
    }
  }

  // An alpha keeps its version on its branch so the next one counts from it. A beta is derived from the
  // commit, and the default branch never gets a pre-release version, so neither is committed.
  if (channel === "beta" || onDefaultBranch) info("The pre-release version is not committed");
  else if (dry) info("[DRY] Would commit and push the version bump");
  else if (await commitAll(`chore(release): ${channel} ${names.join(", ")}`))
    await push(".", undefined, process.env.GITHUB_TOKEN);

  setOutput("versions", JSON.stringify(versions));
  await writeSummary(`${channel === "alpha" ? "Alpha" : "Beta"} release`, dry, [
    ["Published", versions.map((version) => `\`${version}\` (tag \`${channel}\`)`)],
    ["Deprecated", deprecated],
  ]);
};

main().catch((error: unknown) => setFailed(error instanceof Error ? error.message : String(error)));
