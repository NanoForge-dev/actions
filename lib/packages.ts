import { $, file, write } from "bun";
import process from "node:process";
import { join } from "path";

import type { IPkg } from "./types";

export const resolveRootPath = (): string => process.env.GITHUB_WORKSPACE ?? process.cwd();

export const resolvePackage = async (name: string): Promise<IPkg> => {
  const pkgs: [IPkg, ...IPkg[]] =
    await $`pnpm list --filter ${name} --recursive --only-projects --prod --json`.json();
  if (pkgs.length <= 0) throw new Error(`Package ${name} not found`);
  return pkgs[0];
};

export const updateVersion = async (pkgPath: string, version: string): Promise<void> => {
  const fullPath = join(pkgPath, "package.json");
  const pkg = await file(fullPath).json();
  pkg.version = version;
  await write(fullPath, `${JSON.stringify(pkg, null, 2)}\n`);
};
