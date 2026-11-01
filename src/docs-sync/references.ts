import { $ } from "bun";
import { cpSync, readdirSync } from "fs";
import { join } from "path";

export const generateReferences = async (path: string) => {
  await $`pnpm run docs`.cwd(path);
};

export const copyReferences = (src: string, dist: string, tag: string) => {
  try {
    readdirSync(src).forEach((pkgName) => {
      const pkgPath = join(src, pkgName);
      const distPath =
        pkgName === "snippets" ? join(dist, pkgName) : join(dist, "references", tag, pkgName);
      cpSync(pkgPath, distPath, { recursive: true });
    });
  } catch {
    console.error(`Failed to copy ${src} to ${dist}`);
  }
};
