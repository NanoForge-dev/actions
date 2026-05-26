import { $, file, write } from "bun";
import { type IPkg, readPackageChangelog } from "lib";
import { join } from "path";

export const runPackageChangelog = async (name: string): Promise<void> => {
  await $`pnpm --filter=${name} run release --skip-automatic-bump --skip-tag`;
};

const parseIntoSections = (body: string): Map<string, string[]> => {
  const sections = new Map<string, string[]>();
  let currentSection: string | null = null;

  for (const line of body.split("\n")) {
    if (line.startsWith("## ")) {
      currentSection = line.slice(3).trim();
      if (!sections.has(currentSection)) sections.set(currentSection, []);
    } else if (currentSection && line.trim()) {
      sections.get(currentSection)?.push(line);
    }
  }
  return sections;
};

const extractCommitHash = (line: string): string | null => {
  const match = line.match(/\(([a-f0-9]{7,40})]\(https?:\/\//);
  return match?.[1] ?? null;
};

const mergePackageBodies = (bodies: string[]): string => {
  const merged = new Map<string, Map<string, string>>();

  for (const body of bodies) {
    for (const [section, lines] of parseIntoSections(body)) {
      if (!merged.has(section)) merged.set(section, new Map());
      const entries = merged.get(section);
      for (const line of lines) {
        const key = extractCommitHash(line) ?? line;
        if (entries && !entries.has(key)) entries.set(key, line);
      }
    }
  }

  return [...merged.entries()]
    .map(([section, entries]) => `## ${section}\n\n${[...entries.values()].join("\n")}`)
    .join("\n\n");
};

const buildVersionHeader = async (
  rootPath: string,
  version: string,
  today: string,
  existing: string | null,
): Promise<string> => {
  try {
    const pkgJson = await file(join(rootPath, "package.json")).json();
    const repoUrl = ((pkgJson.repository?.url as string) ?? "")
      .replace(/^git\+/, "")
      .replace(/\.git$/, "");
    if (!repoUrl) throw new Error("No repository URL found");
    const name = pkgJson.name as string;
    const prevVersion = existing?.match(/^# \[(\d+\.\d+\.\d+)/m)?.[1];

    if (prevVersion) {
      return `# [${version}](${repoUrl}/compare/${name}@${prevVersion}...${name}@${version}) - (${today})`;
    }
    return `# [${version}](${repoUrl}/tree/${name}@${version}) - (${today})`;
  } catch {
    return `# ${version} - (${today})`;
  }
};

export const updateRootChangelog = async (
  rootPath: string,
  pkgs: IPkg[],
  version: string,
): Promise<void> => {
  const changelogPath = join(rootPath, "CHANGELOG.md");
  const today = new Date().toISOString().slice(0, 10);

  const bodies: string[] = [];
  for (const pkg of pkgs) {
    const body = await readPackageChangelog(pkg.path, pkg.name, version);
    if (body) bodies.push(body);
  }

  if (!bodies.length) return;

  const mergedBody = mergePackageBodies(bodies);

  let existing: string | null = null;
  try {
    existing = await file(changelogPath).text();
  } catch {
    // file doesn't exist yet
  }

  const versionHeader = await buildVersionHeader(rootPath, version, today, existing);
  const newEntry = `${versionHeader}\n\n${mergedBody}\n\n`;

  if (!existing) {
    await write(
      changelogPath,
      `# Changelog\n\nAll notable changes to this project will be documented in this file.\n\n${newEntry}`,
    );
    return;
  }

  const insertAt = existing.search(/\n# \[/);
  const updated =
    insertAt !== -1
      ? `${existing.slice(0, insertAt + 1)}${newEntry}${existing.slice(insertAt + 1)}`
      : `${existing}\n${newEntry}`;

  await write(changelogPath, updated);
};
