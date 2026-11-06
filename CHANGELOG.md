# Changelog

All notable changes to this project will be documented in this file.

# [3.1.1](https://github.com/NanoForge-dev/actions/compare/3.1.0...3.1.1) - (2026-11-06)

## Bug Fixes

- **actions:** Restore the turbo cache before prepare in tests (#113) ([4831564](https://github.com/NanoForge-dev/actions/commit/4831564ed257bacea3cd153f5d05e60630af7e59)) by @Exeloo

# [3.1.0](https://github.com/NanoForge-dev/actions/compare/3.0.0...3.1.0) - (2026-11-06)

## Ci

- **actions:** Push with short-lived tokens of one github app per target (#109) ([4820ab2](https://github.com/NanoForge-dev/actions/commit/4820ab245e856cbe9a5386db809e4ebde6426e88)) by @Exeloo
  - **BREAKING CHANGE:** the NANOFORGE_BOT_TOKEN secret is replaced by the NANOFORGE_BOT_PRIVATE_KEY
secret and the NANOFORGE_BOT_CLIENT_ID variable of the NanoForge bot GitHub App.

* ci(actions): keep the release app key out of consumer jobs and skip docs without a token

* ci(actions): one github app per push target (docs, deploy, release)

* ci(actions): open the release pr and commit as the release app, falling back to github_token

* ci(actions): keep the release app key in a main-only environment

* docs(actions): note that a dist rebuild needs the same release token source

# [3.0.0](https://github.com/NanoForge-dev/actions/compare/2.1.5...3.0.0) - (2026-11-06)

## Bug Fixes

- **release-dev:** Add deprecated check on version resolution (#92) ([ee45c12](https://github.com/NanoForge-dev/actions/commit/ee45c1266dbef0fa8cf481773a483d963de17772)) by @Exeloo

## Features

- **actions:** Shared actions, reusable workflows and ci for v3 (#100) ([0a39bbc](https://github.com/NanoForge-dev/actions/commit/0a39bbc2ba27718ee8cfa5230bfc7553d5b2b2c5)) by @Exeloo
  - **BREAKING CHANGE:** the npm package is no longer consumed. Every action is
renamed, its inputs changed (dry is now dry-run, packages come from the
config) and repositories must call them by git tag.

* ci(actions): add reusable workflows and caller templates

* docs(actions): document the v3 actions, workflows and release config

* docs(actions): fix the auto version, docs-sync paths and config schema docs

* fix(setup): create the swap file inline instead of a third-party action

* fix(prerelease): output plain name@version in versions

* fix(actions): keep tokens out of checkouts and pin third-party actions

- checkouts use persist-credentials: false; pushes get their token per
  command (release-pr, prerelease, docs-sync, docker-release)
- caller templates pass the declared secrets instead of secrets: inherit
- prepare-env refuses keys such as NODE_OPTIONS, PATH, LD_* or GITHUB_*
- non-GitHub actions pinned by commit sha; dependabot scans the action dirs
- docs sync runs in the release job, so the repo is prepared once

* fix(actions): align names, defaults and outputs across actions and workflows

* fix(actions): fail on tag errors and scope docs and versions correctly

- tag, release and v<major> failures fail the job (an existing tag only warns)
- docs sync only after a release of docs.group, with that group's version,
  and never fails the release job
- a shared group bumps from the highest version of the whole group, so
  releasing a subset never reuses a version
- an independent release skips packages with nothing to release
- alpha and beta skip private packages and npm: false groups
- groups can't share a tag format that doesn't name them

* fix(actions): allowlist prepare env, mask auth headers and check tag errors

- new export-env action: one allowlist (NODE_ENV, PUBLIC_*, NEXT_PUBLIC_*,
  VITE_*) instead of five copies of a denylist
- per-command git auth headers are masked; docs-sync drops its token from
  the env before running the repo's docs script; input renamed docs-token
- a 422 only counts as a re-run when GitHub says the tag or release already
  exists, and an existing tag must point at the same commit

* fix(actions): count shared commits from the oldest release and validate tag formats

- a shared release bumps the group's highest version but counts commits
  from the oldest last release of the selected packages, so no unreleased
  commit is missed
- tagFormat must contain {version}, never {packages} or {run}, {package}
  when independent, and {package} only in a single-package shared group;
  docs.group must be shared
- release plans the tags before publishing to npm
- prerelease publishes in dependency order and its commit lists what it published
- the release job fetches full history and tags for the docs references

* fix(actions): count shared commits per package and push docs without the token step

- a shared release counts each selected package's commits from its own last
  release; a package with no tag counts from the group's current tag, never
  the whole history, so no false major bump
- docs-sync commits in the step that runs the repo's docs script and pushes
  in a separate step that alone receives the token
- the base64 credential is masked on its own as well as the full header

* fix(actions): push docs from a clean repo and report empty shared releases

- docs-sync pushes from a fresh bare repo with no system or global git
  config, hooks disabled and a checked github.com remote, so config written
  by the docs script can't redirect the authenticated push
- release-pr checks for an empty shared release before picking a version,
  so it fails with the nothing-to-release message instead of a TypeError

* fix(docs-sync): push only to the docs-repository input with a header scoped to it

* fix(docs-sync): push from a fresh temp repo with proxy and tls settings forced

* ci(actions): reference the actions as nanoforge-dev in lowercase

* build(actions): update the transitive dependencies flagged by pnpm audit

* feat(nf-registry-release): bump changed packages in a release pr and publish only newer versions
  - **BREAKING CHANGE:** dist/ is no longer committed on main; use @v3, a version tag or release/v3.

* fix(actions): never move the release branch back and guard the release base ref

* fix(actions): make the release branch guards fail closed

# [2.1.5](https://github.com/NanoForge-dev/actions/compare/2.1.4...2.1.5) - (2026-06-17)

## Bug Fixes

- **git:** Disable any git push hook checks on all actions with --no-v… (#85) ([73285c6](https://github.com/NanoForge-dev/actions/commit/73285c6d5ef0e1e23ec8216de459cb59939bc0ce)) by @MartinFillon
- Add index order (#86) ([799e169](https://github.com/NanoForge-dev/actions/commit/799e169b0a9389e9821f64cf2ed89c84c67f12db)) by @Exeloo

# [2.1.4](https://github.com/NanoForge-dev/actions/compare/2.1.3...2.1.4) - (2026-06-11)

## Bug Fixes

- Change docs order and add a root to groups (#83) ([520fb9e](https://github.com/NanoForge-dev/actions/commit/520fb9eb185c27c705bd2a33992c2c639ebba335)) by @Exeloo

## Documentation

- Add actions docs (#82) ([fd5c580](https://github.com/NanoForge-dev/actions/commit/fd5c580ac050811d74145cf18b3c0f9ee0059d93)) by @Exeloo

# [2.1.3](https://github.com/NanoForge-dev/actions/compare/2.1.2...2.1.3) - (2026-06-04)

## Bug Fixes

- Add fetch tags to sync docs (#80) ([5845972](https://github.com/NanoForge-dev/actions/commit/584597285285b70cd92b603eaddac54e6ace4ef9)) by @Exeloo

# [2.1.2](https://github.com/NanoForge-dev/actions/compare/2.1.1...2.1.2) - (2026-06-04)

## Bug Fixes

- Add repository name to sync docs (#78) ([23457d1](https://github.com/NanoForge-dev/actions/commit/23457d18df8ba11c3e80cd17f447cae44af5ef84)) by @Exeloo

# [2.1.1](https://github.com/NanoForge-dev/actions/compare/2.1.0...2.1.1) - (2026-06-04)

## Bug Fixes

- Change sync docs defaults and release tag patterns (#76) ([06026e4](https://github.com/NanoForge-dev/actions/commit/06026e4ac909824284f38d12352e8554027e04c5)) by @Exeloo

# [@nanoforge-dev/actions@2.1.0](https://github.com/NanoForge-dev/actions/compare/@nanoforge-dev/actions@1.4.2...@nanoforge-dev/actions@2.1.0) - (2026-06-03)

## Bug Fixes

- Change sync docs defaults (#74) ([5821464](https://github.com/NanoForge-dev/actions/commit/58214645ac6c5bba97766031c0e2efe371daeba4)) by @Exeloo
- **release-dev:** Remove the push of version in main branch (#68) ([97f50f4](https://github.com/NanoForge-dev/actions/commit/97f50f4a57202b0ea0bd92b2c0183736a79cfc8f)) by @Exeloo

## Features

- Add sync docs action (#73) ([35736a2](https://github.com/NanoForge-dev/actions/commit/35736a281943d12edfdebebcc4124fd4fb1eebda)) by @Exeloo
- Add new release actions (#67) ([8aa1b46](https://github.com/NanoForge-dev/actions/commit/8aa1b461aff81df28cb27a3f01b22b7612543375)) by @Exeloo

# [@nanoforge-dev/actions@2.0.0](https://github.com/NanoForge-dev/actions/compare/@nanoforge-dev/actions@1.4.2...@nanoforge-dev/actions@2.0.0) - (2026-05-26)

## Bug Fixes

- **release-dev:** Remove the push of version in main branch (#68) ([97f50f4](https://github.com/NanoForge-dev/actions/commit/97f50f4a57202b0ea0bd92b2c0183736a79cfc8f)) by @Exeloo

## Features

- Add new release actions (#67) ([8aa1b46](https://github.com/NanoForge-dev/actions/commit/8aa1b461aff81df28cb27a3f01b22b7612543375)) by @Exeloo

# [@nanoforge-dev/actions@1.4.2](https://github.com/NanoForge-dev/actions/compare/@nanoforge-dev/actions@1.4.1...@nanoforge-dev/actions@1.4.2) - (2026-05-17)

## Bug Fixes

- Change directory where jq is executed (#60) ([cd64002](https://github.com/NanoForge-dev/actions/commit/cd6400233c82629de7102afe1237e66936f567be)) by @MartinFillon

# [@nanoforge-dev/actions@1.4.1](https://github.com/NanoForge-dev/actions/compare/@nanoforge-dev/actions@1.4.0...@nanoforge-dev/actions@1.4.1) - (2026-05-17)

## Bug Fixes

- **synchronize-docs:** Missing $ in inputs getting (#58) ([24c31f9](https://github.com/NanoForge-dev/actions/commit/24c31f938c032e12ee6eb165474fe26e3f67483e)) by @MartinFillon

# [@nanoforge-dev/actions@1.4.0](https://github.com/NanoForge-dev/actions/compare/@nanoforge-dev/actions@1.3.0...@nanoforge-dev/actions@1.4.0) - (2026-05-17)

## Bug Fixes

- Add docs action custom 'build' to add it to dist (#56) ([f243cc8](https://github.com/NanoForge-dev/actions/commit/f243cc8d625b6ba14ba3483fd1a46429f4733b88)) by @MartinFillon

## Features

- Create a docs synchronization action to streamline the process (#53) ([860f949](https://github.com/NanoForge-dev/actions/commit/860f949afeadb345310cc7f0133afc888560174c)) by @MartinFillon

### New Contributors

- @MartinFillon made their first contribution in #56

# [@nanoforge-dev/actions@1.3.0](https://github.com/NanoForge-dev/actions/compare/@nanoforge-dev/actions@1.2.3...@nanoforge-dev/actions@1.3.0) - (2026-04-20)

## Features

- Add release nanoforge packages action (#45) ([c4001f0](https://github.com/NanoForge-dev/actions/commit/c4001f0f9a6c7545afd54c982dbfe76d1fc126ea)) by @Exeloo

# [@nanoforge-dev/actions@1.2.3](https://github.com/NanoForge-dev/actions/compare/@nanoforge-dev/actions@1.2.2...@nanoforge-dev/actions@1.2.3) - (2026-03-13)

## Features

- Add tag format to release packages ci (#42) ([bea9f2e](https://github.com/NanoForge-dev/actions/commit/bea9f2e1fc48c8bcfb2cfe84c21f07d90c536eae)) by @Exeloo

# [@nanoforge-dev/actions@1.2.2](https://github.com/NanoForge-dev/actions/compare/@nanoforge-dev/actions@1.2.1...@nanoforge-dev/actions@1.2.2) - (2026-03-13)

## Features

- Add tag format to create release tag ci (#40) ([559817c](https://github.com/NanoForge-dev/actions/commit/559817cc3308f6eddea2e6702c43d7c81fca6471)) by @Exeloo

# [@nanoforge-dev/actions@1.2.1](https://github.com/NanoForge-dev/actions/compare/@nanoforge-dev/actions@1.2.0...@nanoforge-dev/actions@1.2.1) - (2026-03-12)

## Bug Fixes

- Add only version handling for changelog (#38) ([bdd1655](https://github.com/NanoForge-dev/actions/commit/bdd16550181717c7d782ddc95641145c87d15f00)) by @Exeloo

# [@nanoforge-dev/actions@1.2.0](https://github.com/NanoForge-dev/actions/compare/@nanoforge-dev/actions@1.1.0...@nanoforge-dev/actions@1.2.0) - (2026-03-12)

## Features

- Add conditionnal npm publish (#36) ([45cdd9d](https://github.com/NanoForge-dev/actions/commit/45cdd9d661210a80184a6964b9c2073ba5c5b0ac)) by @Exeloo
- Add docs (#9) ([be56b16](https://github.com/NanoForge-dev/actions/commit/be56b164971786fe692e8025ff2f22dfe5ce1180)) by @Exeloo

### New Contributors

- @dependabot[bot] made their first contribution in #35
- @renovate[bot] made their first contribution in #20

# [@nanoforge-dev/actions@1.1.0](https://github.com/NanoForge-dev/actions/tree/@nanoforge-dev/actions@1.1.0) - (2026-01-19)

## Features

- Add author to commit (#5) ([f895eaa](https://github.com/NanoForge-dev/actions/commit/f895eaa1c94493281b1c3af308e1d81db5720d3e)) by @Exeloo
- Add commit to pre-release process (#4) ([5e4fcf2](https://github.com/NanoForge-dev/actions/commit/5e4fcf275cd538d156d06a938c5c82e792f4dfe1)) by @Exeloo
- Migrate to new repo and add pre-release ([36bfe8f](https://github.com/NanoForge-dev/actions/commit/36bfe8fa0e1b6411310e681d1b9ec91046582b56)) by @Exeloo

### New Contributors

- @Exeloo made their first contribution in #6

# [@nanoforge-dev/actions@1.0.2](https://github.com/NanoForge-dev/Engine/compare/@nanoforge-dev/actions@1.0.1...@nanoforge-dev/actions@1.0.2) - (2026-01-10)

## Bug Fixes

- **actions:** Change release process to fit with new actions (#183) ([3016d45](https://github.com/NanoForge-dev/Engine/commit/3016d45b41a7f8bbd16962cb5f7aea956f84bde3)) by @Exeloo
- **actions:** Change compilation to handle usage of actions from other repositories (#182) ([31a9514](https://github.com/NanoForge-dev/Engine/commit/31a951416c44301e5784b51bcfaff7fc49f176c8)) by @Exeloo

# [@nanoforge-dev/actions@1.0.1](https://github.com/NanoForge-dev/Engine/compare/@nanoforge-dev/actions@1.0.0...@nanoforge-dev/actions@1.0.1) - (2026-01-09)

## Bug Fixes

- Add permissions to ci and change release process (#179) ([91b8832](https://github.com/NanoForge-dev/Engine/commit/91b88329d61fd96305c5868d39589439cfa08814)) by @Exeloo

# [@nanoforge-dev/actions@1.0.0](https://github.com/NanoForge-dev/Engine/tree/@nanoforge-dev/actions@1.0.0) - (2026-01-09)

## CI

- Add release ci (#164) ([7e771e5f](https://github.com/NanoForge-dev/Engine/commit/7e771e5fac06fe3b1b4ecf45d99fa8432a8a02ee)) by @Exeloo

