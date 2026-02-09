Testing
=======

This guide covers how to run quality checks on the NanoForge Actions codebase.

Running Lint Checks
-------------------

The project uses ESLint for code quality and Prettier for formatting. Run both
checks with:

.. code-block:: bash

    pnpm lint

This executes:

1. ``prettier --check .`` -- Verifies all files match the expected formatting
2. ``eslint --format=pretty src`` -- Checks TypeScript source files for lint
   errors

Auto-Fixing Issues
------------------

To automatically fix formatting and lint issues:

.. code-block:: bash

    pnpm format

This executes:

1. ``prettier --write .`` -- Reformats all files
2. ``eslint --fix --format=pretty src`` -- Auto-fixes lint issues where possible

Type Checking
-------------

TypeScript type checking is part of the build process:

.. code-block:: bash

    # Type check only (no output)
    npx tsc --noEmit

    # Full build (includes type checking)
    pnpm build

Building
--------

Verify that the project builds without errors:

.. code-block:: bash

    pnpm build

This runs type checking and bundles the code with tsup. Output is placed in
``dist/``.

Pre-Commit Hooks
----------------

The project has pre-commit hooks configured via Husky and lint-staged. When you
commit, the following checks run automatically on staged files:

- **Prettier**: Formats all staged files
- **ESLint**: Fixes lint issues in staged ``src/**/*.ts`` files

If any check fails, the commit is rejected. Fix the issues and try again.

CI Pipeline
-----------

The GitHub Actions CI pipeline (``tests.yml``) runs on:

- Every pull request targeting ``main``
- Every push to ``main``

The CI pipeline runs ``pnpm lint`` and blocks merging if it fails.

Local Testing
-------------

Dry Run Mode
^^^^^^^^^^^^

All actions support a ``--dry`` flag for testing without side effects:

.. code-block:: bash

    # Build first
    pnpm build

    # Test release-packages
    bun ./dist/release-packages/index.js @nanoforge-dev/actions --dry

    # Test create-release-pr
    bun ./dist/create-release-pr/index.js @nanoforge-dev/actions --dry

The dry run will:

- Log what would be published
- Skip actual npm publishing
- Skip GitHub release/PR creation
- Still generate the job summary output

Testing Against npm Registry
^^^^^^^^^^^^^^^^^^^^^^^^^^^^

The release action checks the npm registry before publishing. You can verify
this manually:

.. code-block:: bash

    # Check if a version exists
    curl -s https://registry.npmjs.org/@nanoforge-dev/actions/1.0.0 | jq .version

Testing GitHub API Integration
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

To test GitHub API calls locally, set the ``GITHUB_TOKEN`` environment variable:

.. code-block:: bash

    export GITHUB_TOKEN="your-personal-access-token"
    bun ./dist/create-release-pr/index.js @nanoforge-dev/actions --dry

Even with the token set, ``--dry`` prevents actual API calls.

Verifying a Full Check
-----------------------

Before submitting a pull request, run the full check locally:

.. code-block:: bash

    pnpm format && pnpm build

This ensures your code passes formatting, lint checks, type checking, and
builds correctly.

Debugging Tips
--------------

Verbose Output
^^^^^^^^^^^^^^

Actions log their progress to stdout. For more detail, check the GitHub Actions
job logs or run locally with the ``--dry`` flag.

Registry Polling
^^^^^^^^^^^^^^^^

After publishing, the ``release-packages`` action polls npm for up to 5 minutes
to confirm the package is available. If this times out, check:

1. npm registry status (status.npmjs.org)
2. Your npm token permissions
3. Package name and scope correctness

Common Issues
^^^^^^^^^^^^^

**"Package not found"** -- The package name doesn't match any workspace package.
Check ``pnpm list --recursive`` output.

**"Could not find the version"** -- cliff-jumper dry run failed to determine
the next version. Ensure your commit history follows conventional commits.

**"Release failed"** -- npm publish failed. Check token permissions and ensure
the version doesn't already exist.
