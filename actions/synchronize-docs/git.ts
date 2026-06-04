import { $ } from "bun";

export const resolveTag = async (path: string): Promise<string> => {
  await $`git fetch --tags`.cwd(path);
  const text = await $`git describe --tags --abbrev=0`.cwd(path).text();
  return text.trim();
};

export const commitAndPush = async (path: string, pkgName: string, tag?: string): Promise<void> => {
  const message = `chore(${pkgName}): deploy docs${tag ? ` v${tag}` : ""}`;

  await $`git add --all`.cwd(path);
  try {
    await $`git -c user.name='github-actions[bot]' -c user.email='username@users.noreply.github.com' commit -m '${message}'`.cwd(
      path,
    );
  } catch (e) {
    console.log(e);
  }

  await $`git push`.cwd(path);
};
