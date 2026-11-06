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
  - `NANOFORGE_BOT_TOKEN`: pushes to `NanoForge-dev/docs` and `NanoForge-dev/cloud-iac`.
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

| Job                       | Runs                                                                                                                            |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `Coding style (<script>)` | `pnpm run <script>`, one matrix leg per entry of `style-scripts` (default `["lint"]`, `[]`: none)                               |
| `Unit tests`              | `pnpm run <unit-script>` (default `test:unit`, empty: no job), then the coverage report                                         |
| `End-to-end tests`        | `pnpm run <e2e-script>` (empty by default: no job)                                                                              |
| `Dependency audit`        | `pnpm audit` on the lockfile, failing from `audit-level` (default `high`; `low`, `moderate`, `high`, `critical`; empty: no job) |

- **Coverage:** the unit job summarizes the lcov reports matching `coverage-files` (default `**/coverage/lcov.info`; empty: none) with [`coverage-report`](#coverage-report) and uploads them as the `coverage` artifact. The unit script must write them.
- **End-to-end hook:** when the repo has a `./.github/actions/prepare-e2e` action, the e2e job runs it after `prepare` (browsers, services, another repo's build). `playwright: true` caches `~/.cache/ms-playwright`, keyed on the lockfile. When the e2e tests fail, `e2e-report-path` (e.g. Playwright traces) is uploaded as the `e2e-report` artifact.
- **Caching:** the pnpm store is cached by [`setup`](#setup) and the turbo outputs (`.turbo/cache`) in the style and e2e jobs when the repo has a `turbo.json`. The unit job runs without the turbo cache: a hit replays the logs without the `coverage/` files, so the report would miss packages. The audit job only needs Node.js and pnpm: it installs nothing and runs no `prepare`.
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
    - uses: nanoforge-dev/actions/docker-release@v3
      with:
        image: ${{ github.repository }}
        version: ${{ needs.release.outputs.version }}
        values-file: kubernetes/nanoforge/<app>-override.yaml
        cloud-iac-token: ${{ secrets.NANOFORGE_BOT_TOKEN }}
```

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

Finds the packages of the config whose version changed between `HEAD^1` and `HEAD`. It publishes them on npm in dependency order (skipping private, `npm: false` and already published ones), then creates the tags and GitHub releases. The changelog comes from the package, or from the root for a shared release of several packages. It does nothing when no version changed. A tag already on the same commit, or a release that already exists (a re-run), only warns; any other failure, including moving `v<major>`, fails the job.

| Input                               | Default | Description                   |
| ----------------------------------- | ------- | ----------------------------- |
| `npm-token`                         |         | npm token (`NODE_AUTH_TOKEN`) |
| `config`, `dry-run`, `github-token` |         |                               |

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

Copies `docs/docs/` and `docs/guides/` of the source repository (and the API references when enabled) into `docs/<category>/` and `guides/<category>/` of the checked-out docs repository, regenerates its `docs.json` navigation, then commits and pushes.

The config is only read when `category` is empty: with a `category` input, `references` and `references-path` default to `false` and `docs/references`.

| Input             | Default               | Description                                                                                                    |
| ----------------- | --------------------- | -------------------------------------------------------------------------------------------------------------- |
| `repository`      | this repo's name      | Commit message scope                                                                                           |
| `category`        | `docs.category`       | Docs category (`engine`, `cli`, `editor`...)                                                                   |
| `src-path`        | `.`                   | Source repository                                                                                              |
| `docs-path`       | `docs-dist`           | Checked-out docs repository                                                                                    |
| `references`      | `docs.references`     | Generate the references with `pnpm run docs`                                                                   |
| `references-path` | `docs.referencesPath` | References directory                                                                                           |
| `version`         |                       | Released version: the references folder (required with references)                                             |
| `docs-token`      |                       | Token that pushes to the docs repository. Empty: its checkout's credentials (then readable by the docs script) |
| `docs-repository` | `NanoForge-dev/docs`  | Repository the token pushes to (never the checkout's remote, which the docs script could change)               |
| `config`          |                       |                                                                                                                |

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

The TypeScript sources are in `src/` and run with Bun. `dist/` holds the bundles the actions run, and it is committed: run `pnpm build` and commit `dist/` with every source change. CI fails when it is stale.

```sh
pnpm test        # bun test
pnpm typecheck
pnpm lint
pnpm build       # bundles src/*/index.ts into dist/
```

To run an action locally, set its inputs as `INPUT_<NAME>` env vars, for example `INPUT_DRY_RUN=true bun dist/release-pr/index.js`.

This repository's own CI is `self-tests.yml` (coding style and typecheck, unit tests with coverage, the `dist/` freshness check, actionlint and the dependency audit). It uses the local actions (`./setup`, `./coverage-report`), not `@v3`, so a change is tested by its own code. The `tests.yml` workflow is for the other repositories.

This repository releases itself with `self-release-pr.yml` and `self-release.yml`. They run the local actions (`./release-pr`), so a release never depends on the previous one, and they move the `v3` tag. Moving a tag onto commits that change workflows may need a token with the workflow permission: `self-release.yml` uses `NANOFORGE_BOT_TOKEN` when it is set, and the job fails if the move fails.

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
