import { setFailed, setOutput } from "@actions/core";
import process from "node:process";
import { join } from "path";

import { loadConfig } from "../lib/config";
import { commitAll } from "../lib/git";
import { getBoolean, getString } from "../lib/inputs";
import { rootPath } from "../lib/workspace";
import { copyDocs } from "./copy-docs";
import { generateDocsConfig } from "./generate/generate-config";
import { copyReferences, generateReferences } from "./references";

const main = async () => {
  const srcPath = getString("src-path", ".");
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
  const references = getBoolean("references", docs?.references ?? false);
  const referencesPath = getString("references-path", docs?.referencesPath ?? "docs/references");
  const version = getString("version");

  copyDocs(join(srcPath, "docs"), docsPath, category);

  if (references) {
    if (!version) throw new Error(`Input "version" is required to publish references`);
    await generateReferences(srcPath);
    copyReferences(join(srcPath, referencesPath), docsPath, version);
  }

  await generateDocsConfig(docsPath);

  // No push here: this step runs the repo's docs script, so the action pushes in a later step that alone
  // holds the token.
  const changed = await commitAll(
    `chore(${repository}): deploy docs${version ? ` v${version}` : ""}`,
    docsPath,
  );
  setOutput("changed", changed ? "true" : "false");
};

main().catch((error: unknown) => setFailed(error instanceof Error ? error.message : String(error)));
