import { type UserConfig, defineConfig } from "tsdown";

function createTsdownConfig({ entry, outDir, copy }: UserConfig = {}) {
  return defineConfig({
    entry,
    outDir,
    copy,
    format: "esm",
    dts: false,
    sourcemap: false,
    fixedExtension: false,
    minify: true,
    platform: "node",
    target: "esnext",
    treeshake: false,
    deps: {
      neverBundle: ["bun"],
      skipNodeModulesBundle: true,
    },
  });
}

const createConfig = (name: string, entries: string[] = []) => {
  return createTsdownConfig({
    entry: [...entries.map((entry) => `src/${name}/${entry}`)],
    outDir: `dist/${name}`,
    copy: [`src/${name}/action.yml`],
  });
};

export default [
  createConfig("create-release-pr", ["index.ts"]),
  createConfig("create-release-tag", ["index.ts"]),
  createConfig("release-packages", ["index.ts"]),
  createConfig("release-nanoforge-packages", ["index.ts"]),
];
