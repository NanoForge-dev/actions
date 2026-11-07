import {
  copyFileSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "fs";
import { dirname, isAbsolute, join, relative, resolve } from "path";

import { rewriteLinks } from "./links";
import { type NavItem, PAGE_FILE, prefixNavigation, validateNavigation } from "./navigation";

/** A validated folder, ready to be written: nothing is written before every folder of the sync is valid. */
export interface FolderPlan {
  src: string;
  /** Site path of the folder, without leading slash: `docs/engine` */
  prefix: string;
  /** Files to copy (relative paths), navigation.json and dot-entries excluded */
  files: string[];
  /** Rewritten content of the .md/.mdx files */
  pages: Map<string, string>;
  navigation: NavItem[];
}

/** Relative paths of the files under `dir`. Dot-entries are skipped; symlinks are problems (they could point out). */
const listFiles = (dir: string, problems: string[], at = ""): string[] =>
  readdirSync(join(dir, at), { withFileTypes: true })
    .filter((entry) => !entry.name.startsWith("."))
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((entry) => {
      const path = at ? `${at}/${entry.name}` : entry.name;
      if (entry.isSymbolicLink()) problems.push(`${path}: symlinks are not synced`);
      else if (entry.isDirectory()) return listFiles(dir, problems, path);
      else if (entry.isFile()) return [path];
      return [];
    });

const hasTitle = (content: string): boolean => {
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/.exec(content)?.[1];
  return frontmatter !== undefined && /^title\s*:\s*\S/m.test(frontmatter);
};

/** Validates `src` (navigation, pages, links) and plans its copy. Problems are returned, not thrown. */
export const planFolder = (
  src: string,
  prefix: string,
  /** Checkout `src` must stay in, with no symlink on the way (a symlinked `docs/` would publish its target) */
  root = src,
): { plan?: FolderPlan; problems: string[] } => {
  const problems: string[] = [];
  const inside = relative(root, src);
  if (inside === ".." || inside.startsWith("../") || isAbsolute(inside))
    return { problems: [".: outside the source repository"] };
  if (realpathSync(src) !== resolve(realpathSync(root), inside))
    return { problems: [".: symlinks are not synced"] };
  // readdirSync follows a symlinked root, and readFileSync a symlinked navigation.json: refuse both.
  if (lstatSync(src).isSymbolicLink()) return { problems: [".: symlinks are not synced"] };
  const files = listFiles(src, problems).filter((path) => path !== "navigation.json");

  let navigation: unknown;
  try {
    if (lstatSync(join(src, "navigation.json")).isSymbolicLink()) return { problems };
    navigation = JSON.parse(readFileSync(join(src, "navigation.json"), "utf8"));
  } catch (error) {
    problems.push(`navigation.json: ${error instanceof Error ? error.message : String(error)}`);
    return { problems };
  }
  problems.push(...validateNavigation(navigation, files));

  const context = {
    pages: new Set(
      files.filter((path) => PAGE_FILE.test(path)).map((path) => path.replace(PAGE_FILE, "")),
    ),
    files: new Set(files),
    prefix,
  };
  const pages = new Map<string, string>();
  for (const file of files.filter((path) => PAGE_FILE.test(path))) {
    const content = readFileSync(join(src, file), "utf8");
    if (!hasTitle(content)) problems.push(`${file}: no frontmatter title`);
    const rewritten = rewriteLinks(content, file, context);
    problems.push(...rewritten.problems);
    pages.set(file, rewritten.content);
  }
  if (problems.length) return { problems };
  return { plan: { src, prefix, files, pages, navigation: navigation as NavItem[] }, problems };
};

/** Replaces `dest` with the planned folder and its navigation.json, prefixed with the site path. */
export const writeFolder = (plan: FolderPlan, dest: string): void => {
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });
  for (const file of plan.files) {
    mkdirSync(dirname(join(dest, file)), { recursive: true });
    const page = plan.pages.get(file);
    if (page === undefined) copyFileSync(join(plan.src, file), join(dest, file));
    else writeFileSync(join(dest, file), page);
  }
  writeJson(join(dest, "navigation.json"), prefixNavigation(plan.navigation, plan.prefix));
};

export const writeJson = (path: string, value: unknown): void =>
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);

/** Throws one error listing every problem, grouped by folder. */
export const assertNoProblems = (results: [folder: string, problems: string[]][]): void => {
  const failed = results.filter(([, problems]) => problems.length);
  if (!failed.length) return;
  throw new Error(
    `The docs are invalid:\n${failed
      .map(
        ([folder, problems]) =>
          `${folder}:\n${problems.map((problem) => `  - ${problem}`).join("\n")}`,
      )
      .join("\n")}`,
  );
};
