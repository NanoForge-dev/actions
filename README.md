<div align="center">
    <br />
    <p>
        <a href="https://github.com/NanoForge-dev"><img src="https://github.com/NanoForge-dev/actions/blob/main/.github/logo.png" width="546" alt="NanoForge" /></a>
    </p>
    <br />
    <p>
        <a href="https://github.com/NanoForge-dev/actions/releases"><img src="https://img.shields.io/github/v/release/NanoForge-dev/actions.svg?maxAge=3600" alt="Latest release" /></a>
		<a href="https://github.com/NanoForge-dev/actions/actions/workflows/tests.yml"><img src="https://github.com/NanoForge-dev/actions/actions/workflows/tests.yml/badge.svg" alt="Tests status" /></a>
        <a href="https://github.com/NanoForge-dev/actions/commits/main/utils/actions"><img src="https://img.shields.io/github/last-commit/NanoForge-dev/actions.svg?logo=github&logoColor=ffffff" alt="Last commit" /></a>
    	<a href="https://github.com/NanoForge-dev/actions/graphs/contributors"><img src="https://img.shields.io/github/contributors/NanoForge-dev/actions.svg?maxAge=3600&logo=github&logoColor=fff&color=00c7be" alt="Contributors" /></a>
    </p>
</div>

## About

`NanoForge-dev/actions` holds the GitHub actions and reusable workflows that every NanoForge repository uses for its CI: release PRs, releases, pre-releases, docs sync, Docker images and triage. Repositories don't install anything: they call the actions and workflows by git tag.

Most of the sources of this package come from [discord.js][discordjs-source]. Special thanks to them!

## Usage

Every repository holds the same caller workflows (copy them from [`templates/workflows`](templates/workflows)) and one config file, [`.github/nanoforge.json`](#release-config). Only the config and the repo's own deploy jobs differ.

```yaml
jobs:
  release-pr:
    uses: NanoForge-dev/actions/.github/workflows/release-pr.yml@v3
    with:
      version: ${{ inputs.version }}
```

A single action can also be used on its own: `uses: NanoForge-dev/actions/release@v3`.

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
2. **Release:** when that PR is merged, [`release`](#release) publishes on npm every package whose `package.json` version changed. It then creates the tag(s) and GitHub release(s), and the docs are synced.
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

| Group key       | Default                                                                         | Description                                                                                                                                               |
| --------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`          | (required)                                                                      | Group name, the `{name}` token                                                                                                                            |
| `packages`      | (required)                                                                      | Packages of the group. A package belongs to one group at most                                                                                             |
| `mode`          | `all`                                                                           | Which packages the dispatch may release. `all`: the whole group (leave `packages` empty). `single`: exactly one. `some`: any subset, and empty means all  |
| `versioning`    | `shared`                                                                        | `shared`: one version (the highest current one, bumped), one tag and one GitHub release. `independent`: each package has its own version, tag and release |
| `npm`           | `true`                                                                          | Publish the non-private packages on npm                                                                                                                   |
| `githubRelease` | `true`                                                                          | Create a GitHub release, else only a tag                                                                                                                  |
| `latest`        | `true` if shared                                                                | Mark the GitHub release as latest                                                                                                                         |
| `tagFormat`     | `{version}` / `{package}@{version}`                                             | Tag of a release. The same format finds the previous tag for the auto version                                                                             |
| `branchFormat`  | `releases/{name}@{version}` / `releases/{name}/{run}`                           | Release branch. It must start with `releases/`                                                                                                            |
| `commitFormat`  | `chore({name}): release {name}@{version}` / `chore({name}): release {packages}` | Commit message and PR title                                                                                                                               |
| `majorTag`      | `false`                                                                         | Also move `v<major>` to the release                                                                                                                       |
| `betaOnMerge`   | `false`                                                                         | Publish a beta when a non-release PR is merged                                                                                                            |

Tokens:

- `{name}`: the group.
- `{package}`: the full name, only when one package is released.
- `{version}`: only when there is a single version.
- `{packages}`: the `name@version` list.
- `{run}`: the run id.

`docs` keys: `category` (required), `references` (`false`) and `referencesPath` (`docs/references`).

## Reusable workflows

Callers are in [`templates/workflows`](templates/workflows).

| Workflow                  | Trigger in the caller                               | Inputs                                                   | Outputs                                          |
| ------------------------- | --------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------ |
| `release-pr.yml`          | `workflow_dispatch`                                 | `group`, `packages`, `version`, `dry-run`, `prepare-env` | `pull-request`                                   |
| `release.yml`             | `pull_request: closed` on `main`                    | `prepare-env`                                            | `released`, `version`, `tag`, `tags`, `packages` |
| `alpha-release.yml`       | `workflow_dispatch` (not on the default branch)     | `packages`, `dry-run`, `prepare-env`                     |                                                  |
| `nf-registry-release.yml` | `workflow_dispatch`                                 | `package`, `exclude`, `path`, `dry-run`, `prepare-env`   |                                                  |
| `pr-triage.yml`           | `pull_request_target`                               |                                                          |                                                  |
| `issue-triage.yml`        | `issues: opened`                                    |                                                          |                                                  |
| `label-sync.yml`          | `push` of `.github/labels.yml`, `workflow_dispatch` |                                                          |                                                  |

`prepare-env` takes env vars for the prepare action, one static `KEY=VALUE` per line (e.g. the editor's `PUBLIC_*` build vars). Keys that change how later steps run (`NODE_OPTIONS`, `PATH`, `LD_*`, `GITHUB_*`...) are refused. Never pass PR-controlled text through it.

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
    - uses: NanoForge-dev/actions/docker-release@v3
      with:
        image: ${{ github.repository }}
        version: ${{ needs.release.outputs.version }}
        values-file: kubernetes/nanoforge/<app>-override.yaml
        cloud-iac-token: ${{ secrets.NANOFORGE_BOT_TOKEN }}
```

## Actions

Every action that takes `config` reads `.github/nanoforge.json` when it is empty. `dry-run: true` logs what would happen and doesn't push, publish or tag.

### `setup`

Installs pnpm and Node.js, with the pnpm store cached, then runs `pnpm install --frozen-lockfile`.

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

Finds the packages of the config whose version changed between `HEAD^1` and `HEAD`. It publishes them on npm in dependency order (skipping private, `npm: false` and already published ones), then creates the tags and GitHub releases. The changelog comes from the package, or from the root for a shared release of several packages. It does nothing when no version changed.

| Input                               | Default | Description                   |
| ----------------------------------- | ------- | ----------------------------- |
| `npm-token`                         |         | npm token (`NODE_AUTH_TOKEN`) |
| `config`, `dry-run`, `github-token` |         |                               |

Outputs: `released`, `version`, `tag` (of the first release), `tags`, `packages` (JSON).

### `prerelease`

Publishes `X.Y.Z-alpha.<branch>.<n>` (alpha) or `X.Y.Z-beta.<sha>` (beta) on npm under the channel's dist-tag, and deprecates the older ones. An alpha bump is committed to its feature branch, so the next alpha counts from it.

| Input                                            | Default | Description                                                                      |
| ------------------------------------------------ | ------- | -------------------------------------------------------------------------------- |
| `channel`                                        | `alpha` | `alpha` or `beta`                                                                |
| `packages`                                       |         | Empty: the only package of the config (alpha) or the `betaOnMerge` groups (beta) |
| `npm-token`, `config`, `dry-run`, `github-token` |         |                                                                                  |

Output: `versions`.

### `nf-registry-release`

Publishes NanoForge components and systems (`nanoforge.manifest.json`) to the NanoForge registry with `nf publish`, dependencies first. It needs the `nf` CLI, logged in.

| Input     | Default    | Description                                                                   |
| --------- | ---------- | ----------------------------------------------------------------------------- |
| `path`    | `packages` | Directory holding the packages                                                |
| `package` | `all`      | One package to release with its dependencies. `all` (or empty): every package |
| `exclude` |            | Packages not to release, unless a released package needs them                 |
| `dry-run` | `false`    |                                                                               |

### `docs-sync`

Copies `docs/docs/` and `docs/guides/` of the source repository (and the API references when enabled) into `docs/<category>/` and `guides/<category>/` of the checked-out docs repository, regenerates its `docs.json` navigation, then commits and pushes.

The config is only read when `category` is empty: with a `category` input, `references` and `references-path` default to `false` and `docs/references`.

| Input             | Default               | Description                                                                 |
| ----------------- | --------------------- | --------------------------------------------------------------------------- |
| `repository`      | this repo's name      | Commit message scope                                                        |
| `category`        | `docs.category`       | Docs category (`engine`, `cli`, `editor`...)                                |
| `src-path`        | `.`                   | Source repository                                                           |
| `docs-path`       | `docs-dist`           | Checked-out docs repository                                                 |
| `references`      | `docs.references`     | Generate the references with `pnpm run docs`                                |
| `references-path` | `docs.referencesPath` | References directory                                                        |
| `version`         |                       | Released version: the references folder (required with references)          |
| `token`           |                       | Token that pushes to the docs repository. Empty: its checkout's credentials |
| `config`          |                       |                                                                             |

### `docker-release`

Builds and pushes `<registry>/<image>:<version>`, then sets that tag in a Helm values file of `NanoForge-dev/cloud-iac` and pushes it (it retries when other image jobs push at the same time).

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

This repository releases itself with `self-release-pr.yml` and `self-release.yml`. They run the local actions (`./release-pr`), so a release never depends on the previous one, and they move the `v3` tag.

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
