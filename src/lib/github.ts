import { info, warning } from "@actions/core";
import { context, getOctokit } from "@actions/github";
import process from "node:process";

let octokit: ReturnType<typeof getOctokit> | undefined;

const client = () => {
  if (octokit) return octokit;
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN is not set (input github-token)");
  octokit = getOctokit(token);
  return octokit;
};

export const defaultBranch = (): string =>
  (context.payload.repository?.default_branch as string | undefined) ?? "main";

export const createPullRequest = async (
  head: string,
  title: string,
  body: string,
): Promise<string> => {
  const { data } = await client().rest.pulls.create({
    ...context.repo,
    base: defaultBranch(),
    head,
    title,
    body,
  });
  return data.html_url;
};

export const createTag = async (tag: string, sha: string): Promise<void> => {
  try {
    await client().rest.git.createRef({ ...context.repo, ref: `refs/tags/${tag}`, sha });
  } catch (error) {
    warning(`Failed to create tag "${tag}": ${error}`);
  }
};

/** Creates or moves `tag` (e.g. `v3`) to `sha`. */
export const moveTag = async (tag: string, sha: string): Promise<void> => {
  try {
    await client().rest.git.updateRef({ ...context.repo, ref: `tags/${tag}`, sha, force: true });
  } catch {
    info(`Tag "${tag}" doesn't exist yet, creating it`);
    await createTag(tag, sha);
  }
};

export const createRelease = async (
  tag: string,
  sha: string,
  body: string | undefined,
  latest: boolean,
): Promise<void> => {
  try {
    await client().rest.repos.createRelease({
      ...context.repo,
      tag_name: tag,
      target_commitish: sha,
      name: tag,
      body: body ?? "",
      generate_release_notes: body === undefined,
      make_latest: latest ? "true" : "false",
    });
  } catch (error) {
    warning(`Failed to create GitHub release "${tag}": ${error}`);
  }
};
