import { context } from "@actions/github";

import { createOctokit } from "../../lib";

const octokit = createOctokit();

export const createPR = async (branchName: string, title: string): Promise<void> => {
  const base = context.payload.repository?.default_branch ?? "main";
  await octokit?.rest.pulls.create({
    ...context.repo,
    base,
    head: branchName,
    title,
  });
};
