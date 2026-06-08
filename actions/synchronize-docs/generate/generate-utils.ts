import { readdirSync, statSync } from "fs";

import { capitalize } from "../../../lib";

export interface IGroup {
  group: string;
  root?: string;
  pages: IPage[];
}

export type IPage = string | IGroup;

export const filter = <T>(arr: (T | undefined)[]): T[] => arr.filter(Boolean) as T[];

export const VARS = {
  basePath: "",
};

export const generateBasePage = (name: string, path: string, root: boolean): IPage | undefined => {
  try {
    const stat = statSync(`${VARS.basePath}${path}`);
    if (stat.isFile()) return root ? undefined : path.replace(/\.mdx?$/, "");
    if (stat.isDirectory()) return generateBaseGroup(name, path, root);
    return undefined;
  } catch {
    return undefined;
  }
};

const formatName = (name: string) => {
  if (name.toLowerCase() === "ecs") return "ECS";
  if (name.toLowerCase() === "cli") return "CLI";
  return capitalize(name);
};

const isNumber = (n: number) => !isNaN(n) && isFinite(n);

const parts = ["engine", "cli", "editor"];

const sortFiles = (a: string, b: string) => {
  if (parts.includes(a) || parts.includes(b)) {
    if (!parts.includes(a)) return 1;
    if (!parts.includes(b)) return -1;
    return parts.indexOf(a) - parts.indexOf(b);
  }

  const aParts = a.split("-");
  const bParts = b.split("-");
  const aNum = +(aParts[0] ?? "undefined");
  const bNum = +(bParts[0] ?? "undefined");

  if (isNumber(aNum) || isNumber(bNum)) {
    if (!isNumber(aNum)) return 1;
    if (!isNumber(bNum)) return -1;
    return aNum - bNum;
  }

  return a.localeCompare(b);
};

export const readdirAndApply = <T, U, F>(
  path: string,
  apply: (name: string, path: string, root: boolean) => T | undefined,
  context: (elements: T[]) => U,
  fallback: F,
): U | F => {
  try {
    return context(
      filter(
        readdirSync(`${VARS.basePath}${path}`)
          .sort(sortFiles)
          .filter((file) => !file.startsWith("."))
          .map((file, _i, array) => {
            const s = file.split("-");
            const n = +(s[0] ?? "undefined");
            if (!isNaN(n) && isFinite(n)) s.shift();
            const name = s.map(formatName).join("-");
            const fullPath = `${path}/${file}`;
            return apply(
              name,
              fullPath,
              array.some((f) => `${f}.mdx` === file || f === `${file}.mdx`),
            );
          }),
      ),
    );
  } catch {
    return fallback;
  }
};

export const generateBaseGroup = (name: string, path: string, root: boolean): IGroup | undefined =>
  readdirAndApply(
    path,
    generateBasePage,
    (e) => {
      const base: IGroup = {
        group: name,
        pages: e,
      };
      if (root) base["root"] = path;
      return base;
    },
    undefined,
  );
