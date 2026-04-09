import { endGroup, getBooleanInput, getInput, startGroup, summary } from "@actions/core";
import { program } from "commander";

import { generateReleaseTree } from "./generate-release-tree";
import { releasePackage } from "./release-package";

function npmPackageLink(packageName: string) {
  return `https://api.nanoforge.eu/registry/${packageName}` as const;
}

const excludeInput = getInput("exclude");
let dryInput = false;

try {
  dryInput = getBooleanInput("dry");
} catch {
  // We're not running in actions or the input isn't set (cron)
}

program
  .name("release Nanoforge packages")
  .description("releases Nanoforge components and systems with proper sequencing")
  .argument("[package]", "release a specific package (and it's dependencies)", getInput("package"))
  .option(
    "-e, --exclude <packages...>",
    "exclude specific packages from releasing (will still release if necessary for another package)",
    excludeInput ? excludeInput.split(",") : [],
  )
  .option("--dry", "skips actual publishing and outputs logs instead", dryInput)
  .option("--path [path]", "path to the packages directory", getInput("path") ?? "packages")
  .parse();

const { dry, exclude, path } = program.opts<{
  dry: boolean;
  exclude: string[];
  path: string;
}>();

const [packageName] = program.processedArgs as [string];
const tree = await generateReleaseTree(path, packageName, exclude);

interface ReleaseResult {
  identifier: string;
  url: string;
}

const publishedPackages: ReleaseResult[] = [];
const skippedPackages: ReleaseResult[] = [];

for (const branch of tree) {
  startGroup(`Releasing ${branch.map(({ name }) => name).join(", ")}`);

  await Promise.all(
    branch.map(async (release) => {
      const published = await releasePackage(release, dry);

      if (published) {
        publishedPackages.push({ identifier: release.name, url: npmPackageLink(release.name) });
      } else {
        skippedPackages.push({ identifier: release.name, url: npmPackageLink(release.name) });
      }
    }),
  );

  endGroup();
}

const result = summary.addHeading("Release summary");

if (dry) {
  result.addRaw("\n\n> [!NOTE]\n> This is a dry run.\n\n");
}

result.addHeading("Released", 2);

if (publishedPackages.length === 0) {
  result.addRaw("\n_None_\n\n");
} else {
  result.addRaw("\n");

  for (const { identifier, url } of publishedPackages) {
    result.addRaw(`- [${identifier}](${url})\n`);
  }

  result.addRaw(`\n`);
}

result.addHeading("Skipped", 2);

if (skippedPackages.length === 0) {
  result.addRaw("\n_None_\n\n");
} else {
  result.addRaw("\n");

  for (const { identifier, url } of skippedPackages) {
    result.addRaw(`- [${identifier}](${url})\n`);
  }

  result.addRaw(`\n`);
}

await result.write();
