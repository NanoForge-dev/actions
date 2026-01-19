import { type Options, defineConfig } from "tsup";

const createTsupConfig = ({
  entry = ["src/index.ts"],
  external = [],
  noExternal = [],
  platform = "node",
  format = ["esm", "cjs"],
  target = "es2022",
  skipNodeModulesBundle = true,
  clean = true,
  shims = format.includes("cjs"),
  cjsInterop = format.includes("cjs"),
  minify = false,
  terserOptions = {
    mangle: false,
    keep_classnames: true,
    keep_fnames: true,
  },
  splitting = false,
  keepNames = true,
  dts = true,
  sourcemap = true,
  esbuildOptions = (options) => {
    options.assetNames = "assets/[name]";
  },
  esbuildPlugins = [],
  treeshake = false,
  outDir = "dist",
  publicDir = false,
  loader = { ".wasm": "copy", ".yml": "copy" },
}: Options = {}) => {
  return defineConfig({
    entry,
    external,
    noExternal,
    platform,
    format,
    skipNodeModulesBundle,
    target,
    clean,
    shims,
    cjsInterop,
    minify,
    terserOptions,
    splitting,
    keepNames,
    dts,
    sourcemap,
    esbuildOptions,
    esbuildPlugins,
    treeshake,
    outDir,
    publicDir,
    loader,
  });
};

const createConfig = (name: string, entries: string[] = []) => {
  return createTsupConfig({
    entry: [`src/${name}/action.yml`, ...entries.map((entry) => `src/${name}/${entry}`)],
    outDir: `dist/${name}`,
    dts: false,
    format: "esm",
    minify: "terser",
    target: "esnext",
  });
};

export default [
  createConfig("create-release-pr", ["index.ts"]),
  createConfig("create-release-tag", ["index.ts"]),
  createConfig("release-packages", ["index.ts"]),
];
