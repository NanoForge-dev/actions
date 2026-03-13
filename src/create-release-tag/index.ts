import { getInput } from "@actions/core";
import { context, getOctokit } from "@actions/github";
import { program } from "commander";
import process from "node:process";

let octokit: ReturnType<typeof getOctokit> | undefined;

if (process.env.GITHUB_TOKEN) {
  octokit = getOctokit(process.env.GITHUB_TOKEN);
}

const bootstrap = async () => {
  program
    .name("create release tag")
    .description("create release tag for monorepo packages with proper sequencing")
    .option("--commit <commit>", "commit sha of the last commit", getInput("commit"))
    .option("--branch <branch>", "head branch of the merged pr", getInput("branch"))
    .option("--format <format>", "format of the tag", getInput("format"))
    .parse();

  const { commit, branch, format } = program.opts<{
    commit: string;
    branch: string;
    format: string;
  }>();

  const org = "@nanoforge-dev";
  const [pkg, version] = branch.replace("releases/", "").split("@");

  if (!pkg || !version) throw new Error("Invalid branch name");

  const tag = format
    .replaceAll("{org}", org)
    .replaceAll("{package}", pkg)
    .replaceAll("{version}", version);

  await octokit?.rest.git.createRef({
    ...context.repo,
    ref: `refs/tags/${tag}`,
    sha: commit,
  });
};

bootstrap().then();
