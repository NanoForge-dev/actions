<div align="center">
    <br />
    <p>
        <a href="https://github.com/NanoForge-dev"><img src="https://github.com/NanoForge-dev/actions/blob/main/.github/logo.png" width="546" alt="NanoForge" /></a>
    </p>
    <br />
    <p>
        <a href="https://www.npmjs.com/package/@nanoforge-dev/actions"><img src="https://img.shields.io/npm/v/@nanoforge-dev/actions.svg?maxAge=3600" alt="npm version" /></a>
        <a href="https://www.npmjs.com/package/@nanoforge-dev/actions"><img src="https://img.shields.io/npm/dt/@nanoforge-dev/actions.svg?maxAge=3600" alt="npm downloads" /></a>
		<a href="https://github.com/NanoForge-dev/actions/actions/workflows/tests.yml"><img src="https://github.com/NanoForge-dev/actions/actions/workflows/tests.yml/badge.svg" alt="Tests status" /></a>
        <a href="https://github.com/NanoForge-dev/actions/actions/workflows/push-docs.yml"><img src="https://github.com/NanoForge-dev/actions/actions/workflows/push-docs.yml/badge.svg" alt="Documentation status" /></a>
        <a href="https://github.com/NanoForge-dev/actions/commits/main/utils/actions"><img src="https://img.shields.io/github/last-commit/NanoForge-dev/actions.svg?logo=github&logoColor=ffffff" alt="Last commit" /></a>
    	<a href="https://github.com/NanoForge-dev/actions/graphs/contributors"><img src="https://img.shields.io/github/contributors/NanoForge-dev/actions.svg?maxAge=3600&logo=github&logoColor=fff&color=00c7be" alt="Contributors" /></a>
    </p>
</div>

## About

`@nanoforge-dev/actions` is library that contains all utils for nanoforge actions.

Most of the sources of this package come from [discord.js][discordjs-source]. Special thanks to them!

## Installation

**Node.js 25 or newer is required.**

```sh
npm install --save-dev @nanoforge-dev/actions
yarn add -D @nanoforge-dev/actions
pnpm add -D @nanoforge-dev/actions
bun add -d @nanoforge-dev/actions
```

## Actions

### `create-packages-release-pr`

Creates a pull request to release one or multiple packages at a shared version. It generates a release branch, bumps versions, and opens a PR ready to merge.

| Input           | Required | Default                                               | Description                                                   |
| --------------- | -------- | ----------------------------------------------------- | ------------------------------------------------------------- |
| `packages`      | yes      | —                                                     | Comma-separated list of package names to release              |
| `version`       | yes      | —                                                     | Version to release all packages at                            |
| `branch-format` | no       | `releases/{package}@{version}`                        | Branch name format. Tokens: `{org}`, `{package}`, `{version}` |
| `commit-format` | no       | `chore({package}): release {org}/{package}@{version}` | Commit message format. Same tokens as `branch-format`         |
| `dry`           | no       | `false`                                               | Skip PR creation and only log what would have happened        |

---

### `release-packages`

Publishes packages to npm and creates a tagged GitHub release after a release PR is merged. Supports single or multi-package releases, using the package changelog (single) or the aggregate root changelog (multiple).

| Input            | Required | Default                     | Description                                                     |
| ---------------- | -------- | --------------------------- | --------------------------------------------------------------- |
| `packages`       | yes      | —                           | Comma-separated list of package names to release                |
| `version`        | no       | —                           | Version being released. Resolved from `package.json` if omitted |
| `tag-format`     | no       | `{org}/{package}@{version}` | Git tag format. Tokens: `{org}`, `{package}`, `{version}`       |
| `npm`            | no       | `true`                      | Publish packages to the npm registry                            |
| `github-release` | no       | `true`                      | Create a GitHub release                                         |
| `latest`         | no       | `true`                      | Mark the GitHub release as the latest release                   |
| `dry`            | no       | `false`                     | Skip publishing and tag creation                                |

---

### `release-nanoforge-packages`

Releases any NanoForge component or system by resolving the dependency tree across a packages directory and publishing in the correct order to the Nanoforge registry.

| Input     | Required | Default    | Description                                                                     |
| --------- | -------- | ---------- | ------------------------------------------------------------------------------- |
| `path`    | no       | `packages` | Path to the packages directory                                                  |
| `package` | no       | —          | Published name of a single package to release (targets one package only)        |
| `exclude` | no       | —          | Comma-separated list of packages to exclude from release (unless depended upon) |
| `dry`     | no       | `false`    | Skip publishing and only log what would have happened                           |

---

### `release-dev`

Publishes a package as a pre-release (e.g. `alpha`, `beta`) to npm, automatically computing and deprecating older pre-release versions under the same tag.

| Input     | Required | Default | Description                                  |
| --------- | -------- | ------- | -------------------------------------------- |
| `package` | yes      | —       | Published name of the package to release     |
| `tag`     | no       | `alpha` | Pre-release tag to publish under             |
| `dry`     | no       | `false` | Skip publishing, deprecation, and the commit |

---

### `synchronize-docs`

Copies documentation from a source repository into a shared docs repository and optionally generates API reference configuration files.

| Input             | Required | Default      | Description                                                                               |
| ----------------- | -------- | ------------ | ----------------------------------------------------------------------------------------- |
| `repository`      | yes      | —            | Name of the repository (used in the commit message)                                       |
| `category`        | yes      | —            | Category of the repository (`engine`, `cli`, `editor` or anything else)                   |
| `src-path`        | no       | `.`          | Path to the source repository directory                                                   |
| `docs-path`       | no       | `docs-dist`  | Path to the docs repository directory                                                     |
| `references`      | no       | `false`      | Generate API reference configuration                                                      |
| `references-path` | no       | `references` | Path to the references directory within `src-path` (required when `references` is `true`) |

## Links

- [GitHub][source]
- [npm][npm]

## Contributing

Before creating an issue, please ensure that it hasn't already been reported/suggested, and double-check the
[documentation][documentation].  
See [the contribution guide][contributing] if you'd like to submit a PR.

## Help

If you don't understand something in the documentation, you are experiencing problems, or you just need a gentle nudge in the right direction, please don't hesitate to ask questions in [discussions][discussions].

[documentation]: https://github.com/NanoForge-dev/actions
[discussions]: https://github.com/NanoForge-dev/actions/discussions
[source]: https://github.com/NanoForge-dev/actions/tree/main/packages/actions
[npm]: https://www.npmjs.com/package/@nanoforge-dev/actions
[contributing]: https://github.com/NanoForge-dev/actions/blob/main/.github/CONTRIBUTING.md
[discordjs-source]: https://github.com/discordjs/discord.js
