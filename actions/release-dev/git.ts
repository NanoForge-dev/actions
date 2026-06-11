import { $ } from "bun";

export const commitAndPush = async (
  pkgName: string,
  version: string,
  tag: string,
): Promise<void> => {
  const shortName = pkgName.split("/").at(-1);
  const message = `chore(${shortName}): release ${tag} ${version}`;

  await $`git add --all`;
  await $`git -c user.name='github-actions[bot]' -c user.email='username@users.noreply.github.com' commit -m '${message}'`;
  await $`git push --no-verify`;
};
