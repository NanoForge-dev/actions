import { endGroup, getInput, startGroup, summary } from "@actions/core";
import { program } from "commander";
import {
  extractTokens,
  formatString,
  readRootChangelog,
  resolveRootPath,
  safeGetBooleanInput,
} from "lib";

import { type ReleaseEntry, generateReleaseTree } from "./generate-release-tree";
import { createGitHubRelease, createTag } from "./github";
import { publishToNpm } from "./npm";

interface ReleaseResult {
  identifier: string;
}

const parseOptions = () => {
  program
    .name("release packages from pr")
    .description(
      "Publishes packages and creates a tagged GitHub release after a release PR is merged",
    )
    .option(
      "--dry",
      "skips publishing and tag creation, outputs logs instead",
      safeGetBooleanInput("dry", false),
    )
    .option("--packages <packages>", "comma-separated list of package names", getInput("packages"))
    .option("--version <version>", "version being released", getInput("version"))
    .option(
      "--tag-format <format>",
      "git tag format ({org}, {package} for single package only, {version})",
      getInput("tag_format") || "{org}/{package}@{version}",
    )
    .option("--npm", "publish packages to npm registry", safeGetBooleanInput("npm", true))
    .option(
      "--github-release",
      "create a GitHub release",
      safeGetBooleanInput("github_release", true),
    )
    .option("--latest", "mark the GitHub release as latest", safeGetBooleanInput("latest", true))
    .parse();

  return program.opts<{
    dry: boolean;
    packages: string;
    version: string;
    tagFormat: string;
    npm: boolean;
    githubRelease: boolean;
    latest: boolean;
  }>();
};

const resolveVersion = (allEntries: ReleaseEntry[], version: string): string => {
  if (version) return version;
  const versions = [...new Set(allEntries.map((e) => e.version))];
  if (versions.length !== 1)
    throw new Error(
      `Packages have mismatched versions (${versions.join(", ")}). Provide --version to override.`,
    );
  return versions[0] as string;
};

const publishPackages = async (
  releaseTree: ReleaseEntry[][],
  dry: boolean,
): Promise<{ published: ReleaseResult[]; skipped: ReleaseResult[] }> => {
  const published: ReleaseResult[] = [];
  const skipped: ReleaseResult[] = [];

  for (const batch of releaseTree) {
    startGroup(`Publishing ${batch.map((e) => `${e.name}@${e.version}`).join(", ")}`);

    await Promise.all(
      batch.map(async (entry) => {
        const wasPublished = await publishToNpm(entry, dry);
        const identifier = `${entry.name}@${entry.version}`;
        if (wasPublished) published.push({ identifier });
        else skipped.push({ identifier });
      }),
    );

    endGroup();
  }

  return { published, skipped };
};

const writeSummary = async (
  tagName: string,
  doNpm: boolean,
  published: ReleaseResult[],
  skipped: ReleaseResult[],
  dry: boolean,
): Promise<void> => {
  const result = summary.addHeading("Release summary");
  if (dry) result.addRaw("\n\n> [!NOTE]\n> This is a dry run.\n\n");

  result.addHeading("Tag", 2);
  result.addRaw(`\n\`${tagName}\`\n\n`);

  if (doNpm) {
    result.addHeading("Published", 2);
    if (published.length === 0) {
      result.addRaw("\n_None_\n\n");
    } else {
      result.addRaw("\n");
      for (const { identifier } of published) result.addRaw(`- \`${identifier}\`\n`);
      result.addRaw("\n");
    }

    result.addHeading("Skipped", 2);
    if (skipped.length === 0) {
      result.addRaw("\n_None_\n\n");
    } else {
      result.addRaw("\n");
      for (const { identifier } of skipped) result.addRaw(`- \`${identifier}\`\n`);
      result.addRaw("\n");
    }
  }

  await result.write();
};

const bootstrap = async () => {
  const {
    dry,
    packages: packagesInput,
    version,
    tagFormat,
    npm: doNpm,
    githubRelease: doGithubRelease,
    latest: makeLatest,
  } = parseOptions();

  const packageNames = packagesInput
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (!packageNames.length) throw new Error("No packages specified");
  if (tagFormat.includes("{package}") && packageNames.length > 1)
    throw new Error(
      "{package} token cannot be used in tag-format when releasing multiple packages",
    );

  const rootPath = resolveRootPath();
  const releaseTree = await generateReleaseTree(packageNames);
  const allEntries = releaseTree.flat();

  const resolvedVersion = resolveVersion(allEntries, version);
  const tagName = formatString(tagFormat, extractTokens(packageNames, resolvedVersion));

  const published: ReleaseResult[] = [];
  const skipped: ReleaseResult[] = [];

  if (doNpm) {
    const results = await publishPackages(releaseTree, dry);
    published.push(...results.published);
    skipped.push(...results.skipped);
  }

  if (doGithubRelease) {
    const changelog =
      allEntries.length === 1
        ? allEntries[0]?.changelog
        : await readRootChangelog(rootPath, resolvedVersion);
    await createGitHubRelease(tagName, changelog, makeLatest, dry);
  } else {
    await createTag(tagName, dry);
  }

  await writeSummary(tagName, doNpm, published, skipped, dry);
};

void bootstrap();
