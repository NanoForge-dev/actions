Actions Reference
=================

This section documents each GitHub Action provided by ``@nanoforge-dev/actions``.

.. _action-release-packages:

release-packages
----------------

Publishes monorepo packages to npm with proper dependency sequencing. Packages
are released in topological order to ensure dependencies are available before
dependents are published.

**Entry Point**: ``src/release-packages/index.ts``

Inputs
^^^^^^

.. list-table::
   :header-rows: 1
   :widths: 18 10 10 15 47

   * - Input
     - Type
     - Required
     - Default
     - Description
   * - ``package``
     - string
     - No
     - ``"all"``
     - Specific package to release (with dependencies), or ``"all"``
   * - ``exclude``
     - string
     - No
     - ``""``
     - Comma-separated list of packages to exclude from release
   * - ``dry``
     - boolean
     - No
     - ``false``
     - Perform a dry run without actual publishing
   * - ``dev``
     - boolean
     - No
     - ``false``
     - Publish development versions with commit hash suffix
   * - ``tag``
     - string
     - No
     - ``"dev"``
     - npm dist-tag for dev releases (only valid with ``dev: true``)

Environment Variables
^^^^^^^^^^^^^^^^^^^^^

.. list-table::
   :header-rows: 1
   :widths: 30 70

   * - Variable
     - Description
   * - ``NODE_AUTH_TOKEN``
     - npm authentication token for publishing
   * - ``GITHUB_TOKEN``
     - GitHub token for creating releases

Behavior
^^^^^^^^

1. Queries pnpm workspace for all publishable packages
2. Builds a dependency tree to determine release order
3. For each tree level, releases packages in parallel:

   - Checks npm registry to skip already-published versions
   - Publishes to npm with provenance
   - Creates a GitHub release (for non-dev releases)
   - Polls npm registry to confirm availability before proceeding

4. Generates a job summary listing released and skipped packages

Dev Mode
^^^^^^^^

When ``dev: true``, the action:

- Appends a timestamp and commit hash to versions (e.g., ``1.0.0-dev.1706140800-abc1234``)
- Publishes with the specified dist-tag (default: ``dev``)
- Skips GitHub release creation
- Replaces ``workspace:^`` with ``workspace:*`` for pinned dev versions

Example Usage
^^^^^^^^^^^^^

.. code-block:: yaml

    - name: Release packages
      uses: ./dist/release-packages
      with:
        package: "@nanoforge-dev/actions"
        dry: false
      env:
        NODE_AUTH_TOKEN: ${{ secrets.NPM_PUBLISH_TOKEN }}
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

----

.. _action-create-release-pr:

create-release-pr
-----------------

Creates a release pull request that includes version bumps and changelog
generation. This is typically the first step in the release workflow.

**Entry Point**: ``src/create-release-pr/index.ts``

Inputs
^^^^^^

.. list-table::
   :header-rows: 1
   :widths: 18 10 10 15 47

   * - Input
     - Type
     - Required
     - Default
     - Description
   * - ``package``
     - string
     - Yes
     - --
     - Package name to release
   * - ``version``
     - string
     - No
     - Auto-generated
     - New version (leave empty for cliff-jumper auto-bump)
   * - ``dry``
     - boolean
     - No
     - ``false``
     - Perform a dry run without creating PR

Environment Variables
^^^^^^^^^^^^^^^^^^^^^

.. list-table::
   :header-rows: 1
   :widths: 30 70

   * - Variable
     - Description
   * - ``GITHUB_TOKEN``
     - GitHub token for creating branches and PRs

Behavior
^^^^^^^^

1. Resolves the target package from pnpm workspace
2. Determines the new version (from input or via cliff-jumper dry run)
3. Creates a release branch (``releases/<package>@<version>``)
4. Updates ``package.json`` with the new version
5. Runs cliff-jumper to generate changelog
6. Commits and pushes the release branch
7. Creates a pull request against ``main``
8. Generates a job summary with version and changelog

Branch Naming
^^^^^^^^^^^^^

Release branches follow the pattern::

    releases/<package-short-name>@<version>

For example, ``@nanoforge-dev/actions@1.1.0`` creates branch
``releases/actions@1.1.0``.

Example Usage
^^^^^^^^^^^^^

.. code-block:: yaml

    - name: Create release PR
      uses: ./dist/create-release-pr
      with:
        package: "@nanoforge-dev/actions"
        version: "1.2.0"
        dry: false
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

----

.. _action-create-release-tag:

create-release-tag
------------------

Creates a git tag after a release pull request is merged. This action is
triggered by the merge event and extracts version information from the branch
name.

**Entry Point**: ``src/create-release-tag/index.ts``

Inputs
^^^^^^

.. list-table::
   :header-rows: 1
   :widths: 18 10 10 15 47

   * - Input
     - Type
     - Required
     - Default
     - Description
   * - ``commit``
     - string
     - Yes
     - --
     - Commit SHA of the merge commit
   * - ``branch``
     - string
     - Yes
     - --
     - Head branch of the merged PR (e.g., ``releases/actions@1.1.0``)

Environment Variables
^^^^^^^^^^^^^^^^^^^^^

.. list-table::
   :header-rows: 1
   :widths: 30 70

   * - Variable
     - Description
   * - ``GITHUB_TOKEN``
     - GitHub token for creating tags

Behavior
^^^^^^^^

1. Parses the branch name to extract the package identifier
2. Converts the branch name to a tag name:
   - ``releases/actions@1.1.0`` -> ``@nanoforge-dev/actions@1.1.0``
3. Creates a lightweight git tag pointing to the merge commit

Tag Format
^^^^^^^^^^

Tags follow the npm package identifier format::

    @nanoforge-dev/<package>@<version>

Example Usage
^^^^^^^^^^^^^

.. code-block:: yaml

    - name: Create release tag
      uses: ./dist/create-release-tag
      with:
        commit: ${{ github.sha }}
        branch: ${{ github.head_ref }}
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

----

Workflow Integration
--------------------

The actions are designed to work together in a release pipeline:

1. **Pre-Release** (manual trigger):

   .. code-block:: yaml

       # Triggers create-release-pr
       # Creates releases/<pkg>@<version> branch
       # Opens PR against main

2. **Review & Merge**:

   - Team reviews the generated changelog
   - PR is merged into main

3. **Tag Creation** (on PR merge):

   .. code-block:: yaml

       # Triggers create-release-tag
       # Creates @nanoforge-dev/<pkg>@<version> tag

4. **Release** (manual or scheduled):

   .. code-block:: yaml

       # Triggers release-packages
       # Publishes to npm
       # Creates GitHub release
