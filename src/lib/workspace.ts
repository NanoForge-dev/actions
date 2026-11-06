import { $, file, write } from "bun";
import process from "node:process";
import { join, relative } from "path";

export interface WorkspacePackage {
  name: string;
  version: string;
  /** Absolute path */
  path: string;
  private: boolean;
  /** Names of the production dependencies */
  dependsOn: string[];
}

interface PnpmProject {
  name?: string;
  version?: string;
  path: string;
  private?: boolean;
  dependencies?: Record<string, unknown>;
}

export const rootPath = (): string => process.env.GITHUB_WORKSPACE ?? process.cwd();

export const listWorkspace = async (): Promise<WorkspacePackage[]> => {
  const projects: PnpmProject[] =
    await $`pnpm list --recursive --only-projects --prod --json`.json();
  return projects
    .filter((project) => project.name && project.version)
    .map((project) => ({
      name: project.name as string,
      version: project.version as string,
      path: project.path,
      private: project.private ?? false,
      dependsOn: Object.keys(project.dependencies ?? {}),
    }));
};

export const findPackages = (
  workspace: WorkspacePackage[],
  names: string[],
): WorkspacePackage[] => {
  const missing = names.filter((name) => !workspace.some((pkg) => pkg.name === name));
  if (missing.length) throw new Error(`Packages not found in the workspace: ${missing.join(", ")}`);
  return names.map((name) => workspace.find((pkg) => pkg.name === name) as WorkspacePackage);
};

/** Path relative to the repo root, for git pathspecs and `git show <ref>:<path>`. */
export const repoRelative = (path: string): string => relative(rootPath(), path) || ".";

export const setVersion = async (pkgPath: string, version: string): Promise<void> => {
  const fullPath = join(pkgPath, "package.json");
  const pkg = await file(fullPath).json();
  pkg.version = version;
  await write(fullPath, `${JSON.stringify(pkg, null, 2)}\n`);
};
