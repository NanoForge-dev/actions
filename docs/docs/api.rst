API Reference
=============

This section documents the internal modules and functions used by the actions.

generate-release-tree
---------------------

**Module**: ``src/release-packages/generate-release-tree.ts``

Builds a dependency-ordered release tree for monorepo packages.

Types
^^^^^

.. code-block:: typescript

    interface ReleaseEntry {
      name: string;           // Package name
      version: string;        // Version to release
      changelog?: string;     // Parsed changelog content
      dependsOn?: string[];   // Internal package dependencies
    }

Functions
^^^^^^^^^

.. function:: generateReleaseTree(dry: boolean, devTag?: string, packageName?: string, exclude?: string[]): Promise<ReleaseEntry[][]>

   Generates a two-dimensional array of release entries. Each inner array
   represents a "level" of packages that can be released in parallel.

   :param dry: If true, skips actual version bumping
   :param devTag: Optional dev tag for prerelease versions
   :param packageName: Target a specific package (with deps) or ``"all"``
   :param exclude: Package names to exclude from release
   :returns: Promise resolving to ordered release tree

   **Algorithm**:

   1. Queries pnpm for all workspace packages
   2. For dev releases, modifies ``package.json`` to pin workspace deps
   3. Parses changelogs for non-dev releases
   4. Builds dependency graph from package dependencies
   5. Topologically sorts into release levels
   6. Prunes tree based on ``packageName`` or ``exclude`` options

.. function:: getReleaseEntries(dry: boolean, devTag?: string): Promise<ReleaseEntry[]>

   Internal function that collects all releasable packages from the workspace.

   :param dry: If true, uses mock version bumping
   :param devTag: Optional dev tag for version generation
   :returns: Promise resolving to flat list of release entries

release-package
---------------

**Module**: ``src/release-packages/release-package.ts``

Handles publishing individual packages to npm and creating GitHub releases.

Functions
^^^^^^^^^

.. function:: releasePackage(release: ReleaseEntry, dry: boolean, devTag?: string, doGitRelease?: boolean): Promise<boolean>

   Publishes a single package to npm.

   :param release: Release entry with name, version, and changelog
   :param dry: If true, logs instead of publishing
   :param devTag: Optional dist-tag for npm publish
   :param doGitRelease: Whether to create a GitHub release (default: ``!devTag``)
   :returns: Promise resolving to ``true`` if published, ``false`` if skipped

   **Behavior**:

   1. Checks npm registry for existing version (skips if found)
   2. Publishes with ``pnpm publish --provenance``
   3. Creates GitHub release if ``doGitRelease`` is true
   4. Polls registry to confirm publication before returning

.. function:: checkRegistry(release: ReleaseEntry): Promise<boolean>

   Checks if a specific version exists on npm.

   :param release: Release entry to check
   :returns: Promise resolving to ``true`` if version exists

.. function:: gitTagAndRelease(release: ReleaseEntry, dry: boolean): Promise<void>

   Creates a GitHub release with the changelog as body.

   :param release: Release entry with changelog
   :param dry: If true, logs instead of creating release

create-release-pr Functions
---------------------------

**Module**: ``src/create-release-pr/functions.ts``

Utility functions for the pre-release workflow.

Types
^^^^^

.. code-block:: typescript

    interface IPkg {
      name: string;      // Package name
      version: string;   // Current version
      path: string;      // Absolute path to package
      private: boolean;  // Whether package is private
    }

Functions
^^^^^^^^^

.. function:: resolvePackage(name: string): Promise<IPkg>

   Resolves a package from the pnpm workspace.

   :param name: Package name to resolve
   :returns: Promise resolving to package info
   :raises Error: If package is not found in workspace

   Uses ``pnpm list --filter <name> --recursive --only-projects --prod --json``.

.. function:: resolveChangelog(path: string, name: string, version: string): Promise<string>

   Extracts the changelog section for a specific version.

   :param path: Path to package directory
   :param name: Package name
   :param version: Version to extract
   :returns: Promise resolving to changelog content

   Parses ``CHANGELOG.md`` and extracts content between version headers.

.. function:: resolveVersion(name: string): Promise<string>

   Determines the next version using cliff-jumper dry run.

   :param name: Package name
   :returns: Promise resolving to next version string
   :raises Error: If version cannot be determined

   Runs ``pnpm --filter=<name> run release --dry-run`` and parses output.

.. function:: checkoutToReleaseBranch(name: string, version: string): Promise<string>

   Creates and checks out a release branch.

   :param name: Package name (scoped)
   :param version: Release version
   :returns: Promise resolving to branch name

   Creates branch ``releases/<short-name>@<version>``.

.. function:: updateVersion(path: string, version: string): Promise<void>

   Updates the version in ``package.json``.

   :param path: Path to package directory
   :param version: New version string

.. function:: runRelease(name: string): Promise<void>

   Runs the release script (cliff-jumper) for a package.

   :param name: Package name

   Executes ``pnpm --filter=<name> run release --skip-automatic-bump --skip-tag``.

.. function:: pushRelease(name: string, version: string, branch: string): Promise<void>

   Commits and pushes the release changes.

   :param name: Package name
   :param version: Release version
   :param branch: Branch name to push

   Creates commit with message ``chore(<short-name>): release <name>@<version>``.

.. function:: createPR(branchName: string): Promise<void>

   Creates a pull request using the GitHub API.

   :param branchName: Source branch for the PR

   Uses the commit message as the PR title.

Constants
---------

NPM Registry URL
^^^^^^^^^^^^^^^^

The actions use the public npm registry::

    https://registry.npmjs.org/

Commit Author
^^^^^^^^^^^^^

Automated commits use the GitHub Actions bot identity::

    user.name:  github-actions[bot]
    user.email: username@users.noreply.github.com
