import { getInput } from "@actions/core";
import { program } from "commander";
import { join } from "path";

import { safeGetBooleanInput } from "../../lib";
import { safeGetStringInput } from "../../lib/inputs";
import { copyDocs } from "./copy-docs";
import { generateDocsConfig } from "./generate/generate-config";
import { commitAndPush, resolveTag } from "./git";
import { copyReferences, generateReferences } from "./references";

const parseOptions = () => {
  program
    .name("synchronize docs")
    .description("Synchronize src docs to the docs repository")
    .option("--src-path <path>", "path of repository containing the src docs", getInput("src_path"))
    .option("--docs-path <path>", "path of repository containing the docs", getInput("docs_path"))
    .option(
      "--references-path <path>",
      "path to the references directory from src-path. Defaults to `references` (required if reference is true)",
      safeGetStringInput("references_path", "references"),
    )
    .option("--category <category>", "category to put the targeted docs", getInput("category"))
    .option(
      "--references",
      "if needed to generate references",
      safeGetBooleanInput("references", false),
    )
    .parse();

  return program.opts<{
    srcPath: string;
    docsPath: string;
    referencesPath: string;
    category: string;
    references: boolean;
  }>();
};

const bootstrap = async () => {
  const { srcPath, docsPath, referencesPath, category, references } = parseOptions();

  copyDocs(join(srcPath, "docs"), docsPath, category);

  let tag: string | undefined = undefined;

  if (references) {
    await generateReferences(srcPath);
    tag = await resolveTag(srcPath);
    copyReferences(join(srcPath, referencesPath), docsPath, tag);
  }

  await generateDocsConfig(docsPath);

  await commitAndPush(docsPath, srcPath, tag);
};

void bootstrap();
