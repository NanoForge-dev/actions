import { generateReferencesTab } from "./generate-references-config";
import { type IGroup, VARS, generateBaseGroup, readdirAndApply } from "./generate-utils";

const BASE_CONFIG = {
  $schema: "https://mintlify.com/docs.json",
  theme: "almond",
  name: "NanoForge",
  custom: {
    css: ["custom.css"],
  },
  colors: {
    primary: "#4923b6",
    light: "#b794f6",
    dark: "#7c3aed",
  },
};

const generateBaseGroups = (path: string): IGroup[] =>
  readdirAndApply(path, generateBaseGroup, (e) => e, []);

const generateBaseTab = (name: string, path: string) => ({
  tab: name,
  dropdowns: readdirAndApply(
    path,
    (subName, subPath) => ({ dropdown: subName, groups: generateBaseGroups(subPath) }),
    (e) => e,
    [],
  ),
});

const generateDocumentationTab = () => generateBaseTab("Documentation", "docs");
const generateGuidesTab = () => generateBaseTab("Guides", "guides");

const generateNavigation = () => ({
  navigation: {
    languages: [
      {
        language: "en",
        tabs: [generateDocumentationTab(), generateGuidesTab(), generateReferencesTab()],
      },
    ],
  },
});

export const generateDocsConfig = async (path: string) => {
  VARS.basePath = `${path}/`;
  const config = { ...BASE_CONFIG, ...generateNavigation() };
  await Bun.write(`${path}/docs.json`, JSON.stringify(config, null, 2));
};
