<div align="center">
    <br />
    <p>
        <a href="https://github.com/NanoForge-dev"><img src="https://github.com/NanoForge-dev/actions/blob/main/.github/logo.png" width="546" alt="NanoForge" /></a>
    </p>
    <br />
    <p>
        <a href="https://github.com/NanoForge-dev/actions/releases"><img src="https://img.shields.io/github/v/release/NanoForge-dev/actions.svg?maxAge=3600" alt="Latest release" /></a>
		<a href="https://github.com/NanoForge-dev/actions/actions/workflows/self-tests.yml"><img src="https://github.com/NanoForge-dev/actions/actions/workflows/self-tests.yml/badge.svg" alt="Tests status" /></a>
        <a href="https://github.com/NanoForge-dev/actions/commits/main/utils/actions"><img src="https://img.shields.io/github/last-commit/NanoForge-dev/actions.svg?logo=github&logoColor=ffffff" alt="Last commit" /></a>
    	<a href="https://github.com/NanoForge-dev/actions/graphs/contributors"><img src="https://img.shields.io/github/contributors/NanoForge-dev/actions.svg?maxAge=3600&logo=github&logoColor=fff&color=00c7be" alt="Contributors" /></a>
    </p>
</div>

## About

`NanoForge-dev/actions` holds the GitHub actions and reusable workflows that every NanoForge repository uses for its CI: release PRs, releases, pre-releases, tests (coding style, unit, end-to-end, coverage, dependency audit), NanoForge registry releases, docs sync, Docker images and triage. Repositories don't install anything: they call the actions and workflows by git tag.

Most of the sources of this package come from [discord.js][discordjs-source]. Special thanks to them!

## Usage

Every repository holds the same caller workflows (copy them from [`templates/workflows`](templates/workflows)) and one config file, [`.github/nanoforge.json`](#release-config). Only the config and the repo's own deploy jobs differ.

```yaml
jobs:
  release-pr:
    uses: nanoforge-dev/actions/.github/workflows/release-pr.yml@v3
    with:
      version: ${{ inputs.version }}
```

A single action can also be used on its own: `uses: nanoforge-dev/actions/release@v3`.

- `@v3` follows the latest `3.x.y` release. Pinning a workflow to `@3.0.0` pins only that workflow file: the actions it calls are always `@v3`, so a repo that needs a fixed release must call the actions itself at that tag.
- Each repository keeps a `./.github/actions/prepare` action. The workflows run it before any release step. It calls [`setup`](#setup) and adds what the repo needs (emsdk, a build, env vars).
- The workflows declare the secrets they use, and callers pass exactly those (never `secrets: inherit`, which would hand every secret of the repo to the code behind `v3`):
  - `NPM_PUBLISH_TOKEN`: npm publishing.
  - `NANOFORGE_DOCS_PRIVATE_KEY`: key of the NanoForge docs GitHub App (Contents write, installed on `NanoForge-dev/docs` only; client ID in the org variable `NANOFORGE_DOCS_CLIENT_ID`), for the docs sync. Pass it only from a repo whose config has docs.
  - `NANOFORGE_DEPLOY_PRIVATE_KEY`: key of the NanoForge deploy GitHub App (Contents write, installed on `NanoForge-dev/cloud-iac` only; client ID in `NANOFORGE_DEPLOY_CLIENT_ID`), for the image jobs that update cloud-iac. Give it only to the repos that deploy.
  - Each job mints a one-hour token for the repo it pushes to (`actions/create-github-app-token`). That scoping is the caller's choice: whoever holds a key gets everything its app is installed with. Hence one app per target, and keys visible only to the repos that need them. The release job runs the repo's own code before minting, so the docs key is exposed to that code (ADR 0010); the deploy key is only used in image jobs, where nothing but a checkout runs before it.
  - `NF_REGISTRY_KEY`: the NanoForge registry.
- Checkouts don't keep credentials (`persist-credentials: false`): a token is only given to the command that pushes, never stored in `.git/config` while dependencies install.
- Whoever can move the `v3` tag runs code with these secrets in every repo. Protect `main` (required review) and the `v*` and version tags (a ruleset that lets only the release update them).

### Release flow

The release flow is unchanged from v2:

1. **Release PR** (`release-pr.yml`): a `workflow_dispatch` takes a group, packages, a version and dry-run.
   - [`release-pr`](#release-pr) bumps the versions, writes the changelogs and opens a `releases/*` PR.
   - When no version is given, it is resolved from the conventional commits since the tag of the current version (built with `tagFormat`; the whole history when that tag doesn't exist), on the paths of the released packages: a breaking change (`!` or `BREAKING CHANGE:`) bumps the major version, `feat` the minor, `fix` and `perf` the patch. A shared group is bumped once, an independent group per package. With no such commit the run fails: give a version to release anyway.
2. **Release:** when that PR is merged, [`release`](#release) publishes on npm every package whose `package.json` version changed. It then creates the tag(s) and GitHub release(s), and the docs are synced when the docs group was released. Merge release PRs with "Squash and merge" or a merge commit: with "Rebase and merge", `HEAD^1` already holds the new versions and nothing is released.
3. **Beta:** any other merged PR publishes a beta of the groups with `betaOnMerge`.
4. **Alpha:** a `workflow_dispatch` on a feature branch publishes an alpha.

## Release config

`.github/nanoforge.json`, validated by [`schema/nanoforge.schema.json`](schema/nanoforge.schema.json):

```jsonc
{
  "$schema": "https://raw.githubusercontent.com/NanoForge-dev/actions/v3/schema/nanoforge.schema.json",
  "groups": [
    {
      "name": "engine", // {name} token; the first group is the default one
      "packages": ["@nanoforge-dev/core", "@nanoforge-dev/ecs"],
      "mode": "all", // all | single | some
      "versioning": "shared", // shared | independent
    },
    {
      "name": "utils",
      "packages": ["@nanoforge-dev/utils-eslint-config", "@nanoforge-dev/utils-prettier-config"],
      "mode": "single",
      "versioning": "independent",
    },
  ],
  "docs": { "category": "engine", "references": true },
}
```

| Group key       | Default                                                                         | Description                                                                                                                                                                                                                                                                                                                                                                             |
| --------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`          | (required)                                                                      | Group name, the `{name}` token                                                                                                                                                                                                                                                                                                                                                          |
| `packages`      | (required)                                                                      | Packages of the group. A package belongs to one group at most                                                                                                                                                                                                                                                                                                                           |
| `mode`          | `all`                                                                           | Which packages the dispatch may release. `all`: the whole group (leave `packages` empty). `single`: exactly one. `some`: any subset, and empty means all                                                                                                                                                                                                                                |
| `versioning`    | `shared`                                                                        | `shared`: one version line for the whole group (its highest current version is bumped, even when only some packages are released; each selected package's commits are counted from its own last release, or from the group's current tag when it has none, and the biggest bump wins), one tag and one GitHub release. `independent`: each package has its own version, tag and release |
| `npm`           | `true`                                                                          | Publish the non-private packages on npm                                                                                                                                                                                                                                                                                                                                                 |
| `githubRelease` | `true`                                                                          | Create a GitHub release, else only a tag                                                                                                                                                                                                                                                                                                                                                |
| `latest`        | `true` if shared                                                                | Mark the GitHub release as latest                                                                                                                                                                                                                                                                                                                                                       |
| `tagFormat`     | `{version}` / `{package}@{version}`                                             | Tag of a release. The same format finds the previous tag for the auto version                                                                                                                                                                                                                                                                                                           |
| `branchFormat`  | `releases/{name}@{version}` / `releases/{name}/{run}`                           | Release branch. It must start with `releases/`                                                                                                                                                                                                                                                                                                                                          |
| `commitFormat`  | `chore({name}): release {name}@{version}` / `chore({name}): release {packages}` | Commit message and PR title                                                                                                                                                                                                                                                                                                                                                             |
| `majorTag`      | `false`                                                                         | Also move `v<major>` to the release                                                                                                                                                                                                                                                                                                                                                     |
| `betaOnMerge`   | `false`                                                                         | Publish a beta when a non-release PR is merged                                                                                                                                                                                                                                                                                                                                          |

Tokens:

- `{name}`: the group.
- `{package}`: the full name, only when one package is released.
- `{version}`: only when there is a single version.
- `{packages}`: the `name@version` list.
- `{run}`: the run id.

`docs` keys: `group` (the first group; only its releases sync the docs, and it must be shared), `category` (required), `references` (`false`) and `referencesPath` (`docs/references`).

A `tagFormat` must contain `{version}`, can't use `{packages}` or `{run}`, must contain `{package}` in an independent group, and can only use `{package}` in a shared group that releases one package. Two groups can't share a tag format unless it holds `{name}` or `{package}`, since their tags would collide. `docs.group` must be a shared group. The config is checked before anything is published. In an independent group with no given version, packages with no feat, fix or breaking commit are skipped.

## Reusable workflows

Callers are in [`templates/workflows`](templates/workflows).

| Workflow                     | Trigger in the caller                                 | Inputs                                                                                                                        | Outputs                                          |
| ---------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `release-pr.yml`             | `workflow_dispatch`                                   | `group`, `packages`, `version`, `dry-run`, `prepare-env`                                                                      | `pull-request`                                   |
| `release.yml`                | `pull_request: closed` on `main`                      | `prepare-env`                                                                                                                 | `released`, `version`, `tag`, `tags`, `packages` |
| `alpha-release.yml`          | `workflow_dispatch` (not on the default branch)       | `packages`, `dry-run`, `prepare-env`                                                                                          | `version`, `versions`, `sha`                     |
| `nf-registry-release-pr.yml` | `workflow_dispatch`                                   | `path`, `dry-run`                                                                                                             | `pull-request`, `packages`                       |
| `nf-registry-release.yml`    | `pull_request: closed` on `main`, `workflow_dispatch` | `package`, `exclude`, `path`, `dry-run`, `prepare-env`                                                                        | `released`, `packages`                           |
| `tests.yml`                  | `pull_request`, `push` on `main`, `workflow_dispatch` | `style-scripts`, `unit-script`, `coverage-files`, `e2e-script`, `e2e-report-path`, `playwright`, `audit-level`, `prepare-env` |                                                  |
| `pr-triage.yml`              | `pull_request_target`                                 |                                                                                                                               |                                                  |
| `issue-triage.yml`           | `issues: opened`                                      |                                                                                                                               |                                                  |
| `label-sync.yml`             | `push` of `.github/labels.yml`, `workflow_dispatch`   |                                                                                                                               |                                                  |

`prepare-env` takes env vars for the prepare action, one static `KEY=VALUE` per line (e.g. the editor's `PUBLIC_*` build vars). Only `NODE_ENV`, `PUBLIC_*`, `NEXT_PUBLIC_*` and `VITE_*` keys are allowed (through the [`export-env`](#export-env) action): any other key could change how the later steps that hold tokens run. Never pass PR-controlled text through it.

### Tests

`tests.yml` runs one job per check, so a failure points at the right one:

| Job                       | Runs                                                                                                                                                       |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Coding style (<script>)` | `pnpm run <script>`, one matrix leg per entry of `style-scripts` (default `["lint"]`, `[]`: none)                                                          |
| `Unit tests`              | `pnpm run <unit-script>` (default `test:unit`, empty: no job), then the coverage report                                                                    |
| `End-to-end tests`        | `pnpm run <e2e-script>` (empty by default: no job)                                                                                                         |
| `Docs check`              | [`docs-sync`](#docs-sync) with `check: true` when the repo has `docs/docs/navigation.json` or `docs/guides/navigation.json` (else the job only checks out) |
| `Dependency audit`        | `pnpm audit` on the lockfile, failing from `audit-level` (default `high`; `low`, `moderate`, `high`, `critical`; empty: no job)                            |

- **Coverage:** the unit job summarizes the lcov reports matching `coverage-files` (default `**/coverage/lcov.info`; empty: none) with [`coverage-report`](#coverage-report) and uploads them as the `coverage` artifact. The unit script must write them.
- **End-to-end hook:** when the repo has a `./.github/actions/prepare-e2e` action, the e2e job runs it after `prepare` (browsers, services, another repo's build). `playwright: true` caches `~/.cache/ms-playwright`, keyed on the lockfile. When the e2e tests fail, `e2e-report-path` (e.g. Playwright traces) is uploaded as the `e2e-report` artifact.
- **Caching:** the pnpm store is cached by [`setup`](#setup) and the turbo outputs (`.turbo/cache`) in the style, unit and e2e jobs when the repo has a `turbo.json`. The cache is restored before `prepare`, so a build run there skips the untouched packages. The unit script itself runs with `TURBO_FORCE=true`: a hit replays the logs without the `coverage/` files, so the report would miss packages. The audit job only needs Node.js and pnpm: it installs nothing and runs no `prepare`.
- **Reports:** every job writes its result in the job summary.

### Registry releases

NanoForge registry packages (`nanoforge.manifest.json`) are released through a PR, like npm packages:

1. **`nf-registry-release-pr.yml`** (`workflow_dispatch`) runs [`nf-registry-release-pr`](#nf-registry-release-pr): it bumps the manifest of every package changed since its last release and opens an `nf-releases/*` PR.
2. **`nf-registry-release.yml`** runs when that PR is merged (a `pull_request: closed` caller on `main`; any other PR is ignored) or from a dispatch. It publishes, with [`nf-registry-release`](#nf-registry-release), only the packages whose manifest version is newer than the registry, then tags them `{package}@{version}`.

The caller needs `contents: write` (and `pull-requests: write` for the PR workflow). The tagged commit is the merge commit of the PR.

### Run names and summaries

The templates set a `run-name` that shows the version or package and `(dry run)`, e.g. `Release PR engine 1.2.0` or `Alpha release core on feat/x`. Every action writes a summary (a title, then sections such as the tags, the packages or the image) to the job summary (`$GITHUB_STEP_SUMMARY`), with a note on dry runs. Steps are named after what they do.

### Deploy jobs

Deploy jobs (Docker images) stay in the caller's `release.yml`. They run after the reusable job:

```yaml
docker:
  name: Push image
  runs-on: ubuntu-latest
  needs: [release]
  if: needs.release.outputs.released == 'true'
  permissions:
    contents: read
    packages: write
  steps:
    - uses: actions/checkout@v7
      with:
        persist-credentials: false
    - id: bot
      uses: actions/create-github-app-token@v3
      with:
        client-id: ${{ vars.NANOFORGE_DEPLOY_CLIENT_ID }}
        private-key: ${{ secrets.NANOFORGE_DEPLOY_PRIVATE_KEY }}
        owner: NanoForge-dev
        repositories: cloud-iac
        permission-contents: write
    - uses: nanoforge-dev/actions/docker-release@v3
      with:
        image: ${{ github.repository }}
        version: ${{ needs.release.outputs.version }}
        values-file: kubernetes/nanoforge/<app>-override.yaml
        cloud-iac-token: ${{ steps.bot.outputs.token }}
```

The app token lasts one hour from the mint step: an image build longer than that fails at the cloud-iac push.

### Alpha images

An alpha can also push a Docker image tagged with its version (`X.Y.Z-alpha.<branch>.<n>`): add a job after the reusable one in the caller's `alpha-release.yml`; its own `permissions` give it `packages: write`. The image gets only the version tag, never `latest`, and it doesn't set `values-file`: the cloud-iac values are what production deploys.

- The app must be in a group of `.github/nanoforge.json`. A private app (or a group with `npm: false`) isn't published on npm, but it still gets its alpha version, committed on the branch like any alpha.
- `version` is set when the alpha holds one package (else empty, and the job is skipped), also on a dry run: keep the `!inputs.dry-run` guard.
- Check out `needs.alpha.outputs.sha`, the commit with the alpha version, so the image reports the version it is tagged with.
- Pass the same `build-args`, `target` and `dockerfile` as the repo's release image job.
- Alphas write their own layer cache (`:buildcache-prerelease`), so a release image never reuses layers built on a feature branch. It is hygiene, not isolation: a branch job with `packages: write` can still push any tag of the package.
- A private app's alpha counts only from the version committed on its branch: a branch recreated with the same name, another branch with the same name after its prefix (`feat/x` and `fix/x`), or a branch with its `chore(release): alpha` commit dropped reuses a number and overwrites that image tag. npm alphas are safe, since npm refuses a version twice.

```yaml
docker:
  name: Push alpha image
  runs-on: ubuntu-latest
  needs: [alpha]
  if: needs.alpha.outputs.version != '' && !inputs.dry-run
  permissions:
    contents: read
    packages: write
  steps:
    - uses: actions/checkout@v7
      with:
        persist-credentials: false
        ref: ${{ needs.alpha.outputs.sha }}
    - uses: nanoforge-dev/actions/docker-release@v3
      with:
        image: ${{ github.repository }}
        version: ${{ needs.alpha.outputs.version }}
```

## Actions

Every action that takes `config` reads `.github/nanoforge.json` when it is empty. `dry-run: true` logs what would happen and doesn't push, publish or tag.

### `setup`

Installs pnpm and Node.js, with the pnpm store cached (keyed on `pnpm-lock.yaml`), then runs `pnpm install --frozen-lockfile`. The summary lists the Node.js and pnpm versions and whether the store cache hit.

| Input          | Default                      | Description                                                     |
| -------------- | ---------------------------- | --------------------------------------------------------------- |
| `node-version` |                              | Node.js version. Empty: read from `.nvmrc`, else `package.json` |
| `install`      | `true`                       | Install the dependencies                                        |
| `registry-url` | `https://registry.npmjs.org` | Registry written to `.npmrc` for publishing                     |
| `swap-size-gb` | `10`                         | Swap added on Linux runners. `0`: none                          |

### `release-pr`

Bumps the packages of a group, writes their changelogs (`pnpm run release` per package, and a merged root changelog for a shared release of several packages), then pushes the branch and opens the PR.

| Input                               | Default     | Description                                               |
| ----------------------------------- | ----------- | --------------------------------------------------------- |
| `group`                             | first group | Release group                                             |
| `packages`                          |             | Comma-separated packages. Empty: the group's mode decides |
| `version`                           |             | Version to release. Empty: resolved from the commits      |
| `config`, `dry-run`, `github-token` |             |                                                           |

Outputs: `branch`, `version` (when every package gets the same version), `pull-request` (empty on a dry run).

### `release`

Finds the packages of the config whose version changed between `base` (`HEAD^1`, the merged commit's parent) and `HEAD`, and tags `HEAD`. It publishes them on npm in dependency order (skipping private, `npm: false` and already published ones), then creates the tags and GitHub releases. The changelog comes from the package, or from the root for a shared release of several packages. It does nothing when no version changed. A tag already on the same commit, or a release that already exists (a re-run), only warns; any other failure, including moving `v<major>`, fails the job.

| Input                               | Default  | Description                           |
| ----------------------------------- | -------- | ------------------------------------- |
| `npm-token`                         |          | npm token (`NODE_AUTH_TOKEN`)         |
| `base`                              | `HEAD^1` | Commit the versions are compared with |
| `config`, `dry-run`, `github-token` |          |                                       |

Outputs: `released`, `version`, `tag` (of the first release), `tags`, `packages` (JSON), `docs-version` (the docs group's version, empty when it wasn't released).

### `prerelease`

Publishes `X.Y.Z-alpha.<branch>.<n>` (alpha) or `X.Y.Z-beta.<sha>` (beta) on npm under the channel's dist-tag, and deprecates the older ones. Private packages and groups with `npm: false` aren't published: an alpha still gives them a version (e.g. for a Docker image), a beta skips them. An alpha bump is committed to its feature branch, so the next alpha counts from it.

| Input                                            | Default | Description                                                                      |
| ------------------------------------------------ | ------- | -------------------------------------------------------------------------------- |
| `channel`                                        | `alpha` | `alpha` or `beta`                                                                |
| `packages`                                       |         | Empty: the only package of the config (alpha) or the `betaOnMerge` groups (beta) |
| `npm-token`, `config`, `dry-run`, `github-token` |         |                                                                                  |

Outputs: `versions` (JSON `name@version` list), `version` (the plain version when the pre-release holds one package, else empty), both also computed on a dry run; `sha` (the commit holding the versions: the pushed alpha bump, else the checked-out commit).

### `nf-registry-release-pr`

For each package of `path`, bumps its manifest version when the registry has nothing newer: the bump comes from the conventional commits that touched the package since its tag `{package}@{version}` (else since the last change of its manifest version): breaking is major, `feat` minor, `fix` and `perf` patch. A package with no version and no release gets `1.0.0`. A manifest version already newer than the registry is kept, unless its tag exists: that version was released then unpublished, and the registry never takes a number twice, so it gets at least a patch bump. Every manifest is checked first (name `@scope/name`, dependencies `@scope/name`, version semver or none), and the run lists every bad one at once. It then pushes an `nf-releases/<run>` branch and opens the PR. The checkout needs the full history and tags (`fetch-depth: 0`, `fetch-tags: true`).

| Input          | Default        | Description                        |
| -------------- | -------------- | ---------------------------------- |
| `path`         | `packages`     | Directory holding the packages     |
| `dry-run`      | `false`        |                                    |
| `github-token` | `github.token` | Pushes the branch and opens the PR |

Outputs: `pull-request` (empty on a dry run or when nothing changed), `packages` (JSON `{name, version}` list).

### `nf-registry-release`

Publishes NanoForge components and systems (`nanoforge.manifest.json`) to the NanoForge registry with `nf publish`, dependencies first, and only the packages whose manifest version is newer than the registry (the others are listed as not published), and never a version whose tag `{package}@{version}` already exists. Manifests are checked as in `nf-registry-release-pr`. Releases run one at a time (`concurrency`). Each published package is tagged `{package}@{version}` on the checked-out commit. It needs the `nf` CLI, logged in, and a token that can create tags (`contents: write`).

| Input          | Default        | Description                                                                   |
| -------------- | -------------- | ----------------------------------------------------------------------------- |
| `path`         | `packages`     | Directory holding the packages                                                |
| `package`      | `all`          | One package to release with its dependencies. `all` (or empty): every package |
| `exclude`      |                | Packages not to release, unless a released package needs them                 |
| `dry-run`      | `false`        |                                                                               |
| `github-token` | `github.token` | Creates the tags                                                              |

Outputs: `released` (`true` when something was published), `packages` (JSON `{name, version}` list).

### `coverage-report`

Sums the lcov reports (`LF/LH`, `FNF/FNH`, `BRF/BRH`) and writes the totals, then one line per report named after its package, in the job summary. `node_modules` is skipped. It doesn't fail when no report matches.

| Input   | Default                 | Description                                  |
| ------- | ----------------------- | -------------------------------------------- |
| `files` | `**/coverage/lcov.info` | Glob of the lcov reports, from the repo root |

Output: `lines` (line coverage of all the reports, e.g. `84.47%`).

### `docs-sync`

Validates the docs of the source repository, then replaces its own folders of the checked-out docs repository with them (and the API references when enabled), commits and pushes. It never writes the docs repository's `docs.json`: that file is written by hand and `$ref`s the `navigation.json` files below (`{ "pages": { "$ref": "./docs/engine/navigation.json" } }`).

**Source layout** (in `src-path`):

```
docs/docs/                   required, Documentation tab: .mdx/.md pages and their assets
docs/docs/navigation.json    required
docs/guides/                 optional, Guides tab
docs/guides/navigation.json  required when docs/guides exists
```

`navigation.json` is a JSON array of Mintlify navigation items, page paths relative to its folder and without extension:

```json
[
  { "group": "Getting started", "icon": "rocket", "pages": ["getting-started/introduction"] },
  {
    "group": "Commands",
    "pages": ["commands/overview", { "group": "Reference", "pages": ["commands/new"] }]
  }
]
```

An item is a page path or a group `{ "group", "pages", "icon"?, "expanded"?, "root"?, "tag"? }`; only `pages` and `root` are rewritten, the other keys pass through. The sync fails, listing every problem, when:

- a path is absolute, has an extension, contains `..` or `./`, or points into a dot-folder;
- a listed page has no `.mdx` or `.md` file, a page is listed more than once (a group `root` counts), or a `.md`/`.mdx` file is not listed (Mintlify would publish it as a hidden page);
- a folder holds a `README.md`, both `x.md` and `x.mdx`, or a symlink, or a page has no frontmatter `title`;
- a relative link or image doesn't resolve to a page or file of the same folder.

Dot-folders (e.g. a `.tsdocs` cache) are never copied. Relative links and images (`[x](../install)`, `![x](./img.png)`, `href="..."`, `src="..."`; `.md`/`.mdx` extensions allowed) are rewritten to absolute site paths (`/docs/engine/install`), keeping `#anchor` and `?query`. Absolute paths, anchors, `http(s):`, `mailto:` and other schemes are left alone, and so are fenced code blocks and inline code.

**Target layout** (in `docs-path`), each folder owned by one source repo:

```
docs/<category>/                       copy of docs/docs (deleted, then recreated)
docs/<category>/navigation.json        its navigation, paths prefixed: "docs/<category>/getting-started/introduction"
guides/<category>/                     same for docs/guides (deleted when the source has none)
guides/<category>/navigation.json
references/<category>/<version>/       the references of this release, navigation.json prefixed "references/<category>/<version>/..."
references/<category>/navigation.json  Mintlify versions, newest first: [{ "version": "2.1.0", "default": true, "pages": [...] }, { "version": "1.4.2", "pages": [...] }]
```

**References** (`references: true`): `pnpm run docs` runs in `src-path` and must write `references-path` (pages with a frontmatter `title`, and a `navigation.json` relative to it), which is validated like the docs. It replaces `references/<category>/<version>/`; then only the highest version of each major is kept, and every other entry of `references/<category>/` is deleted (an older version, a placeholder page). Nothing is written before the docs, guides and references are all valid.

**Check mode** (`check: true`): validates `docs/docs` and `docs/guides` (navigation and links) and stops. It needs no docs repository and no config, generates no references and commits nothing. The [`tests.yml`](#tests) workflow runs it in its `Docs check` job.

**Push:** a separate step that alone gets the token. It pushes from a fresh repository with no system or global git config, the token in a per-command header, masked. When another repo pushed its docs in between, it fetches the remote branch, rebases the docs commit on it and retries, up to 3 attempts (repos write disjoint folders, so a conflict fails the step).

The config is only read when `category` is empty: with a `category` input, `references` and `references-path` default to `false` and `docs/references`.

| Input             | Default                  | Description                                                                                                    |
| ----------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `repository`      | this repo's name         | Commit message scope                                                                                           |
| `category`        | `docs.category`          | Docs category (`engine`, `cli`, `loader`, `editor`...): `a-z`, `0-9` and `-` only                              |
| `src-path`        | `.`                      | Source repository                                                                                              |
| `docs-path`       | `docs-dist`              | Checked-out docs repository                                                                                    |
| `references`      | `docs.references`        | Generate the references with `pnpm run docs`                                                                   |
| `references-path` | `docs.referencesPath`    | References directory, from `src-path`                                                                          |
| `version`         |                          | Released version (`x.y.z`): the references folder (required with references)                                   |
| `docs-token`      |                          | Token that pushes to the docs repository. Empty: its checkout's credentials (then readable by the docs script) |
| `docs-repository` | `NanoForge-dev/docs`     | Repository the token pushes to (never the checkout's remote, which the docs script could change)               |
| `config`          | `.github/nanoforge.json` | Release config, from the repository root                                                                       |
| `check`           | `false`                  | `true`: only validate the source docs (see check mode)                                                         |

### `export-env`

Exports static build variables, one `KEY=VALUE` per line, to the next steps of the job. It is an allowlist: only `NODE_ENV`, `PUBLIC_*`, `NEXT_PUBLIC_*` and `VITE_*` keys are accepted, and any other line fails the step.

| Input | Default | Description              |
| ----- | ------- | ------------------------ |
| `env` |         | One `KEY=VALUE` per line |

### `docker-release`

Builds and pushes `<registry>/<image>:<version>` with Docker Buildx, caching the layers in the registry under `<registry>/<image>:buildcache`, or `:buildcache-prerelease` for an alpha version (`-alpha.`, which reads both and writes only its own) (not the GitHub cache: release runs start from `pull_request` events, whose cache scope no later run can read), then sets that tag in a Helm values file of `NanoForge-dev/cloud-iac` and pushes it (it retries when other image jobs push at the same time).

| Input                             | Default                       | Description                                             |
| --------------------------------- | ----------------------------- | ------------------------------------------------------- |
| `image`                           | (required)                    | Image without the registry, e.g. `nanoforge-dev/editor` |
| `version`                         | (required)                    | Image tag, the `release` output                         |
| `registry`                        | `ghcr.io`                     |                                                         |
| `dockerfile`, `context`, `target` | `Dockerfile`, `.`, last stage |                                                         |
| `build-args`                      |                               | One `KEY=VALUE` per line                                |
| `values-file`                     |                               | Values file in cloud-iac. Empty: don't update cloud-iac |
| `values-key`                      | `.image.tag`                  | Path of the tag in the values file                      |
| `cloud-iac-token`                 |                               | Required with `values-file`                             |
| `github-token`                    | `github.token`                | Pushes to the registry                                  |

## Development

The TypeScript sources are in `src/` and run with Bun. The actions run the bundles in `dist/` (`pnpm build`), which is never committed on `main` or feature branches (it is gitignored). This repo's CI builds it in `./.github/actions/prepare`. A release builds it too: `self-release.yml` commits it on top of the merged commit, pushes that commit to `release/v<major>` (force-moved, like the `v<major>` tag) and puts the tags and the GitHub release on it. It refuses to move `release/v<major>` back to an older version, and stops before pushing when the version tag already sits on another commit. So `@v3`, `@<version>` and `@release/v3` hold `dist/`, `@main` doesn't.

```sh
pnpm test        # bun test
pnpm typecheck
pnpm lint
pnpm build       # bundles src/*/index.ts into dist/ (gitignored)
```

To run an action locally, set its inputs as `INPUT_<NAME>` env vars, for example `INPUT_DRY_RUN=true bun dist/release-pr/index.js`.

This repository's own CI is `self-tests.yml` (coding style and typecheck, unit tests with coverage, actionlint and the dependency audit). It uses the local actions (`./setup`, `./coverage-report`), not `@v3`, so a change is tested by its own code. The `tests.yml` workflow is for the other repositories.

This repository releases itself with `self-release-pr.yml` and `self-release.yml`. They run the local actions (`./release-pr`), so a release never depends on the previous one, and they move the `v3` tag. Moving a tag or `release/v3` onto commits that change workflows needs the workflows permission, which `GITHUB_TOKEN` can't have: `self-release-pr.yml` and `self-release.yml` use a token of the NanoForge release GitHub App (installed on this repo only: Contents, Pull requests and Workflows write; key `NANOFORGE_RELEASE_PRIVATE_KEY` and client ID `NANOFORGE_RELEASE_CLIENT_ID` in this repo's `release` environment, whose deployment branches allow `main` only). `self-release-pr.yml` runs only when dispatched from `main`; `self-release.yml` runs on every push to `main` and releases only when the commit changes the `package.json` version (a merged release PR). So no branch code ever gets the release key. The release PR is then opened by the app, so `self-tests.yml` runs on it, and the commits are authored by its bot account. When the app can't give a token (no key, or a permission it isn't granted), the run warns and falls back to `GITHUB_TOKEN`: the release PR then gets no CI run, and moving `v3` or `release/v3` across workflow changes fails. The release key never reaches a consumer's job, since it can move `v3`. The job fails if the move fails.

## Links

- [GitHub][source]

## Contributing

Before creating an issue, please ensure that it hasn't already been reported/suggested, and double-check the
[documentation][documentation].  
See [the contribution guide][contributing] if you'd like to submit a PR.

## Help

If you don't understand something in the documentation, you are experiencing problems, or you just need a gentle nudge in the right direction, please don't hesitate to ask questions in [discussions][discussions].

[documentation]: https://github.com/NanoForge-dev/actions
[discussions]: https://github.com/NanoForge-dev/actions/discussions
[source]: https://github.com/NanoForge-dev/actions/tree/main/packages/actions
[contributing]: https://github.com/NanoForge-dev/actions/blob/main/.github/CONTRIBUTING.md
[discordjs-source]: https://github.com/discordjs/discord.js
