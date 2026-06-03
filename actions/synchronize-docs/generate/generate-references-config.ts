import { readdirSync } from "fs";

import { VARS, generateBasePage, readdirAndApply } from "./generate-utils";

const generatePages = (path: string) => readdirAndApply(path, generateBasePage, (e) => e, []);

const generateVersion = (version: string) => ({
  version,
  dropdowns: readdirAndApply(
    `references/${version}`,
    (name, path) => ({
      dropdown: name,
      pages: generatePages(path),
    }),
    (e) => e,
    [],
  ),
});

const generateVersions = () => {
  try {
    const versions = readdirSync(`${VARS.basePath}references`).sort((a, b) => {
      const versionsA = a.split(".").map(Number);
      const versionsB = b.split(".").map(Number);
      for (let i = 0; i < Math.max(versionsA.length, versionsB.length); i++) {
        const verA = versionsA[i];
        const verB = versionsB[i];
        if (verA && verB) {
          if (verA > verB) return -1;
          if (verA < verB) return 1;
        } else if (verA !== undefined) return -1;
        else if (verB !== undefined) return 1;
      }
      return 0;
    });
    return versions.map(generateVersion);
  } catch {
    return [];
  }
};

export const generateReferencesTab = () => ({
  tab: "References",
  versions: generateVersions(),
});
