import { setSecret } from "@actions/core";
import { $ } from "bun";

const BOT = [
  "-c",
  "user.name=github-actions[bot]",
  "-c",
  "user.email=41898282+github-actions[bot]@users.noreply.github.com",
];

export const checkoutBranch = async (branch: string, cwd = "."): Promise<void> => {
  await $`git checkout -B ${branch}`.cwd(cwd);
};

/** Commits every change. Returns false when there was nothing to commit. */
export const commitAll = async (message: string, cwd = "."): Promise<boolean> => {
  await $`git add --all`.cwd(cwd);
  if ((await $`git diff --cached --quiet`.cwd(cwd).nothrow()).exitCode === 0) return false;
  await $`git ${BOT} commit -m ${message} --no-verify`.cwd(cwd);
  return true;
};

/** Auth for one git command, so a token never sits in .git/config for later steps to read. */
const authArgs = (token?: string): string[] => {
  if (!token) return [];
  const basic = Buffer.from(`x-access-token:${token}`).toString("base64");
  const header = `AUTHORIZATION: basic ${basic}`;
  setSecret(basic);
  setSecret(header);
  return ["-c", `http.https://github.com/.extraheader=${header}`];
};

/** Pushes the current branch, or `branch` to `origin/branch`. Without `token`, uses the checkout's credentials. */
export const push = async (cwd = ".", branch?: string, token?: string): Promise<void> => {
  const auth = authArgs(token);
  if (branch)
    await $`git ${auth} push origin ${`refs/heads/${branch}:refs/heads/${branch}`} --no-verify`.cwd(
      cwd,
    );
  else await $`git ${auth} push --no-verify`.cwd(cwd);
};

export const headSha = async (): Promise<string> => (await $`git rev-parse HEAD`.text()).trim();

export const tagExists = async (tag: string): Promise<boolean> =>
  (await $`git rev-parse --verify --quiet ${`refs/tags/${tag}`}`.nothrow().quiet()).exitCode === 0;

/** Throws unless `ref` names a commit (a bad ref would read as "no file there"). */
export const assertCommit = async (ref: string): Promise<void> => {
  const result = await $`git rev-parse --verify --quiet --end-of-options ${`${ref}^{commit}`}`
    .nothrow()
    .quiet();
  if (result.exitCode !== 0) throw new Error(`"${ref}" is not a commit of this checkout`);
};

/** Content of `path` at `ref`, or undefined when it doesn't exist there. */
export const showFile = async (ref: string, path: string): Promise<string | undefined> => {
  const result = await $`git show --end-of-options ${`${ref}:${path}`}`.nothrow().quiet();
  return result.exitCode === 0 ? result.text() : undefined;
};

/** Full commit messages in `from..HEAD` (all history when `from` is undefined) touching `paths`. */
export const commitMessages = async (
  from: string | undefined,
  paths: string[],
): Promise<string[]> => {
  const range = from ? `${from}..HEAD` : "HEAD";
  const out = await $`git log ${range} --format=%B%x1e -- ${paths}`.text();
  return out
    .split("\x1e")
    .map((message) => message.trim())
    .filter(Boolean);
};

/** Last commit whose diff adds or removes a line matching `pattern` in `path`, or undefined. */
export const lastCommitChanging = async (
  path: string,
  pattern: string,
): Promise<string | undefined> =>
  (await $`git log -1 --format=%H ${`-G${pattern}`} -- ${path}`.text()).trim() || undefined;
