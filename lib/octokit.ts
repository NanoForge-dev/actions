import { getOctokit } from "@actions/github";
import process from "node:process";

export const createOctokit = (): ReturnType<typeof getOctokit> | undefined => {
  if (!process.env.GITHUB_TOKEN) return undefined;
  return getOctokit(process.env.GITHUB_TOKEN);
};
