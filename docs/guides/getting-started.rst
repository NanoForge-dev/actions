Getting Started
===============

This guide explains how to use ``@nanoforge-dev/actions`` to automate releases
in your NanoForge monorepo.

Prerequisites
-------------

- `Node.js <https://nodejs.org/>`_ version 25 or later
- `pnpm <https://pnpm.io/installation>`_ 10.x
- `Bun <https://bun.sh/>`_ runtime (for local execution)
- A GitHub repository with Actions enabled
- An npm account with publish access

Setup
-----

1. **Install the package** as a dev dependency:

   .. code-block:: bash

       pnpm add -D @nanoforge-dev/actions

2. **Configure npm authentication** in your repository:

   - Go to Settings > Secrets and variables > Actions
   - Add ``NPM_PUBLISH_TOKEN`` with your npm automation token

3. **Copy the workflow files** to your ``.github/workflows/`` directory.

Release Workflow
----------------

Pre-Release (Create Release PR)
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

Trigger the pre-release workflow to create a release pull request:

.. code-block:: yaml

    # .github/workflows/pre-release.yml
    name: Pre-Release

    on:
      workflow_dispatch:
        inputs:
          version:
            description: "New version (leave empty for auto)"
            type: string
            required: false
          dry_run:
            description: Perform a dry run?
            type: boolean
            default: false

    permissions:
      contents: write
      pull-requests: write

    jobs:
      create-release-pr:
        name: Create release PR
        runs-on: ubuntu-latest
        steps:
          - name: Checkout repository
            uses: actions/checkout@v6
            with:
              fetch-depth: 0
              fetch-tags: true

          - name: Setup Node.js
            uses: actions/setup-node@v4
            with:
              node-version: 25

          - name: Install dependencies
            run: pnpm install --frozen-lockfile

          - name: Build actions
            run: pnpm build

          - name: Create release PR
            uses: ./dist/create-release-pr
            with:
              package: "@your-scope/your-package"
              version: ${{ inputs.version }}
              dry: ${{ inputs.dry_run }}
            env:
              GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

Release (Publish to npm)
^^^^^^^^^^^^^^^^^^^^^^^^

After the release PR is merged, trigger the release workflow:

.. code-block:: yaml

    # .github/workflows/release.yml
    name: Release

    on:
      workflow_dispatch:
        inputs:
          dry_run:
            description: Perform a dry run?
            type: boolean
            default: false

    permissions:
      contents: write

    jobs:
      npm-publish:
        name: npm publish
        runs-on: ubuntu-latest
        steps:
          - name: Checkout repository
            uses: actions/checkout@v6

          - name: Setup Node.js
            uses: actions/setup-node@v4
            with:
              node-version: 25
              registry-url: "https://registry.npmjs.org"

          - name: Install dependencies
            run: pnpm install --frozen-lockfile

          - name: Build actions
            run: pnpm build

          - name: Release packages
            uses: ./dist/release-packages
            with:
              package: "@your-scope/your-package"
              dry: ${{ inputs.dry_run }}
            env:
              NODE_AUTH_TOKEN: ${{ secrets.NPM_PUBLISH_TOKEN }}
              GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

Tag Creation (On PR Merge)
^^^^^^^^^^^^^^^^^^^^^^^^^^

Automatically create tags when release PRs are merged:

.. code-block:: yaml

    # .github/workflows/release-tag.yml
    name: Release Tag

    on:
      pull_request:
        types: [closed]
        branches: [main]

    permissions:
      contents: write

    jobs:
      create-tag:
        name: Create release tag
        runs-on: ubuntu-latest
        if: github.event.pull_request.merged && startsWith(github.head_ref, 'releases/')
        steps:
          - name: Checkout repository
            uses: actions/checkout@v6

          - name: Setup Node.js
            uses: actions/setup-node@v4
            with:
              node-version: 25

          - name: Install dependencies
            run: pnpm install --frozen-lockfile

          - name: Build actions
            run: pnpm build

          - name: Create release tag
            uses: ./dist/create-release-tag
            with:
              commit: ${{ github.sha }}
              branch: ${{ github.head_ref }}
            env:
              GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

Local Usage
-----------

The actions can also be run locally for testing:

.. code-block:: bash

    # Build the actions first
    pnpm build

    # Dry run release
    bun ./dist/release-packages/index.js @your-scope/package --dry

    # Dry run pre-release
    bun ./dist/create-release-pr/index.js @your-scope/package --dry

CLI Options
^^^^^^^^^^^

release-packages:

.. code-block:: text

    Usage: release packages [options] [package]

    Arguments:
      package                    release a specific package (and its deps)

    Options:
      -e, --exclude <packages>   exclude packages from releasing
      --dry                      skip actual publishing
      --dev                      publish development versions
      --tag <tag>                tag for dev releases (default: "dev")

create-release-pr:

.. code-block:: text

    Usage: create release pr [options] [package]

    Arguments:
      package                    package to release

    Options:
      --dry                      skip actual PR creation
      --version <version>        new version of the package

Typical Workflow
----------------

A typical release workflow:

1. **Trigger pre-release** via GitHub Actions UI:

   - Select the target package
   - Optionally specify a version (or leave empty for auto)
   - Run the workflow

2. **Review the PR**:

   - Check the generated changelog
   - Verify the version bump
   - Approve and merge

3. **Tag is created automatically** when the PR merges.

4. **Trigger release** via GitHub Actions UI:

   - Package is published to npm
   - GitHub release is created with changelog

5. **Verify on npm**:

   .. code-block:: bash

       npm view @your-scope/your-package

Dev Releases
------------

For continuous integration, you can publish development versions:

.. code-block:: yaml

    - name: Dev release
      uses: ./dist/release-packages
      with:
        package: "all"
        dev: true
        tag: "next"
      env:
        NODE_AUTH_TOKEN: ${{ secrets.NPM_PUBLISH_TOKEN }}

This publishes versions like ``1.0.0-next.1706140800-abc1234`` tagged as
``next`` on npm.

Install dev versions with:

.. code-block:: bash

    pnpm add @your-scope/package@next
