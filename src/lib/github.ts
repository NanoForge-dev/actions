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

const status = (error: unknown): number | undefined =>
  (error as { status?: number } | undefined)?.status;

/** Creates `tag`. An existing tag (a re-run) only warns; any other failure throws. */
export const createTag = async (tag: string, sha: string): Promise<void> => {
  try {
    await client().rest.git.createRef({ ...context.repo, ref: `refs/tags/${tag}`, sha });
  } catch (error) {
    if (status(error) !== 422) throw new Error(`Failed to create tag "${tag}": ${error}`);
    warning(`Tag "${tag}" already exists`);
  }
};

/** Creates or moves `tag` (e.g. `v3`) to `sha`. Throws when it can't, so consumers never silently stay behind. */
export const moveTag = async (tag: string, sha: string): Promise<void> => {
  try {
    await client().rest.git.updateRef({ ...context.repo, ref: `tags/${tag}`, sha, force: true });
  } catch (error) {
    if (status(error) !== 422) throw new Error(`Failed to move tag "${tag}": ${error}`);
    info(`Tag "${tag}" doesn't exist yet, creating it`);
    await createTag(tag, sha);
  }
};

/** Creates the GitHub release of `tag`. An existing release (a re-run) only warns; any other failure throws. */
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
    if (status(error) !== 422)
      throw new Error(`Failed to create the GitHub release "${tag}": ${error}`);
    warning(`GitHub release "${tag}" already exists`);
  }
};
