import { info, warning } from "@actions/core";
import { context } from "@actions/github";
import { createOctokit } from "lib";

const octokit = createOctokit();

export const createTag = async (tagName: string, dry: boolean): Promise<void> => {
  if (dry) {
    info(`[DRY] Would create tag "${tagName}"`);
    return;
  }

  try {
    await octokit?.rest.git.createRef({
      ...context.repo,
      ref: `refs/tags/${tagName}`,
      sha: context.sha,
    });
  } catch (error) {
    warning(`Failed to create tag "${tagName}": ${error}`);
  }
};

export const createGitHubRelease = async (
  tagName: string,
  changelog: string | undefined,
  latest: boolean,
  dry: boolean,
): Promise<void> => {
  if (dry) {
    info(`[DRY] Would create GitHub release "${tagName}"`);
    return;
  }

  try {
    await octokit?.rest.repos.createRelease({
      ...context.repo,
      tag_name: tagName,
      name: tagName,
      body: changelog ?? "",
      generate_release_notes: changelog === undefined,
      make_latest: latest ? "true" : "false",
    });
  } catch (error) {
    warning(`Failed to create GitHub release "${tagName}": ${error}`);
  }
};
