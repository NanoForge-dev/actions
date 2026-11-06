import { setFailed, setOutput } from "@actions/core";
import { existsSync, rmSync } from "fs";
import process from "node:process";
import { join } from "path";

import { loadConfig } from "../lib/config";
import { commitAll } from "../lib/git";
import { getBoolean, getString } from "../lib/inputs";
import { writeSummary } from "../lib/summary";
import { rootPath } from "../lib/workspace";
import { type FolderPlan, assertNoProblems, planFolder, writeFolder } from "./folder";
import { generateReferences, isVersion, writeReferences } from "./references";

const PARTS = ["docs", "guides"] as const;

/**
 * Plans docs/docs and docs/guides of the source. Guides are optional (no plan: the target folder is removed);
 * docs are required, so a wrong src-path can't wipe the published docs.
 */
const planParts = (srcPath: string, category: string) =>
  PARTS.map((part) => {
    const src = join(srcPath, "docs", part);
    const result = existsSync(src)
      ? planFolder(src, `${part}/${category}`)
      : { problems: part === "docs" ? ["missing: every synced repo has docs/docs"] : [] };
    return { part, src, ...result };
  });

const main = async () => {
  const srcPath = getString("src-path", ".");
  const check = getBoolean("check", false);

  if (check) {
    // Validation only: the category just shapes the rewritten links, the docs repo is not needed.
    const parts = planParts(srcPath, getString("category", "check"));
    assertNoProblems(parts.map(({ src, problems }) => [src, problems]));
    setOutput("changed", "false");
    await writeSummary("Docs check", false, [
      ["Checked", parts.filter(({ plan }) => plan).map(({ src }) => `\`${src}\``)],
    ]);
    return;
  }

  const docsPath = getString("docs-path", "docs-dist");
  const repository = getString(
    "repository",
    process.env.GITHUB_REPOSITORY?.split("/")[1]?.toLowerCase(),
  );
  if (!repository) throw new Error(`Input "repository" is required`);

  // Inputs win over the `docs` entry of the config, so the action also works without a config.
  const docs = getString("category")
    ? undefined
    : (await loadConfig(rootPath(), getString("config"))).docs;
  const category = getString("category", docs?.category);
  if (!category) throw new Error(`Input "category" is required (or "docs.category" in the config)`);
  // The category and the version become folder names in the docs repo.
  if (!/^[a-z0-9-]+$/.test(category))
    throw new Error(`Invalid category "${category}": only a-z, 0-9 and -`);
  const references = getBoolean("references", docs?.references ?? false);
  const referencesPath = getString("references-path", docs?.referencesPath ?? "docs/references");
  const version = getString("version");

  const parts = planParts(srcPath, category);
  let referencesPlan: { plan?: FolderPlan; problems: string[] } | undefined;
  if (references) {
    if (!version) throw new Error(`Input "version" is required to publish references`);
    if (!isVersion(version))
      throw new Error(`Invalid version "${version}": expected x.y.z (semver)`);
    await generateReferences(srcPath);
    referencesPlan = planFolder(join(srcPath, referencesPath), `references/${category}/${version}`);
  }
  // Nothing is written before everything is valid, so a broken nav never wipes the published docs.
  assertNoProblems([
    ...parts.map(({ src, problems }): [string, string[]] => [src, problems]),
    ...(referencesPlan
      ? [[join(srcPath, referencesPath), referencesPlan.problems] as [string, string[]]]
      : []),
  ]);

  for (const { part, plan } of parts) {
    const dest = join(docsPath, part, category);
    if (plan) writeFolder(plan, dest);
    else rmSync(dest, { recursive: true, force: true });
  }
  const versions = referencesPlan?.plan
    ? writeReferences(referencesPlan.plan, join(docsPath, "references", category), version)
    : undefined;

  // No push here: this step runs the repo's docs script, so the action pushes in a later step that alone
  // holds the token.
  const changed = await commitAll(
    `chore(${repository}): deploy docs${version ? ` v${version}` : ""}`,
    docsPath,
  );
  setOutput("changed", changed ? "true" : "false");
  await writeSummary(`Docs sync ${repository}${version ? ` v${version}` : ""}`, false, [
    ["Category", [`\`${category}\``]],
    [
      "Synced",
      parts.map(
        ({ part, plan }) =>
          `\`${part}/${category}\`: ${plan ? "replaced" : "removed (none in the source)"}`,
      ),
    ],
    [
      "References",
      versions
        ? [
            `Kept: ${versions.kept.map((kept) => `\`${kept}\``).join(", ")}`,
            ...(versions.kept.includes(version)
              ? []
              : [`\`${version}\` removed: a newer version of its major is published`]),
            ...(versions.removed.length
              ? [`Removed: ${versions.removed.map((name) => `\`${name}\``).join(", ")}`]
              : []),
          ]
        : [],
    ],
    ["Docs commit", changed ? ["Committed, pushed by the next step"] : []],
  ]);
};

main().catch((error: unknown) => setFailed(error instanceof Error ? error.message : String(error)));
