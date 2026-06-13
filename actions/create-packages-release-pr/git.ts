import { $ } from "bun";

export const checkoutToReleaseBranch = async (branchName: string): Promise<void> => {
  await $`git checkout -B ${branchName}`;
};

export const commitAndPush = async (branchName: string, message: string): Promise<void> => {
  await $`git add --all --no-verify`;
  await $`git -c user.name='github-actions[bot]' -c user.email='username@users.noreply.github.com' commit -m '${message}'`;
  await $`git push origin refs/heads/${branchName}:${branchName} --no-verify`;
};
