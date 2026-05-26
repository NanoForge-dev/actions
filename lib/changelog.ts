import { file } from "bun";
import { join } from "path";

const extractSection = (
  content: string,
  matchHeader: (line: string) => boolean,
): string | undefined => {
  const lines: string[] = [];
  let found = false;

  for (const line of content.split("\n")) {
    if (line.startsWith("# [")) {
      if (found) break;
      if (!matchHeader(line)) continue;
      found = true;
      continue;
    }
    if (found) lines.push(line);
  }

  if (!lines.length) return undefined;
  return `${lines.join("\n").replace(/^\s+|\s+$/g, "")}\n`;
};

export const readPackageChangelog = async (
  pkgPath: string,
  name: string,
  version: string,
): Promise<string | undefined> => {
  try {
    const content = await file(join(pkgPath, "CHANGELOG.md")).text();
    return extractSection(
      content,
      (line) => line.startsWith(`# [${name}@${version}]`) || line.startsWith(`# [${version}]`),
    );
  } catch {
    return undefined;
  }
};

export const readRootChangelog = async (
  rootPath: string,
  version: string,
): Promise<string | undefined> => {
  try {
    const content = await file(join(rootPath, "CHANGELOG.md")).text();
    return extractSection(content, (line) => line.startsWith(`# [${version}]`));
  } catch {
    return undefined;
  }
};
