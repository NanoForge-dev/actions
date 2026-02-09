Contributing
============

This guide explains how to contribute to the NanoForge Actions project.

Prerequisites
-------------

- `Node.js <https://nodejs.org/>`_ version 25
- `pnpm <https://pnpm.io/installation>`_ 10.x
- `Bun <https://bun.sh/>`_ runtime

Setup
-----

1. **Fork and clone** the repository:

   .. code-block:: bash

       git clone https://github.com/<your-username>/actions.git
       cd actions

2. **Ensure you are on the main branch**:

   .. code-block:: bash

       git checkout main

3. **Install dependencies**:

   .. code-block:: bash

       pnpm install --frozen-lockfile

   This also sets up Husky git hooks via the ``prepare`` script.

4. **Create a feature branch**:

   .. code-block:: bash

       git checkout -b feat/my-feature

Development Workflow
--------------------

1. Make your changes in the ``src/`` directory.

2. Run formatting and lint fixes:

   .. code-block:: bash

       pnpm format

3. Build the project to verify there are no type errors:

   .. code-block:: bash

       pnpm build

4. Run the full lint check:

   .. code-block:: bash

       pnpm lint

5. Test your changes locally with dry run:

   .. code-block:: bash

       bun ./dist/<action>/index.js --dry

Commit Convention
-----------------

This project uses `Conventional Commits <https://www.conventionalcommits.org/>`_.
Every commit message must follow this format:

::

    <type>(<scope>): <description>

    [optional body]

    [optional footer(s)]

Valid types:

.. list-table::
   :header-rows: 1
   :widths: 15 85

   * - Type
     - Purpose
   * - ``feat``
     - A new feature
   * - ``fix``
     - A bug fix
   * - ``docs``
     - Documentation changes
   * - ``chore``
     - Maintenance tasks (deps, CI, tooling)
   * - ``refactor``
     - Code restructuring without behavior change
   * - ``perf``
     - Performance improvements
   * - ``test``
     - Adding or updating tests
   * - ``style``
     - Code style changes (formatting, whitespace)

Examples:

.. code-block:: text

    feat(release-packages): add support for scoped exclusions
    fix(create-release-pr): handle missing changelog gracefully
    docs: update contributing guide
    chore(deps): update @actions/core to v2

Commit messages are validated by ``commitlint`` via a git hook. Commits that do
not follow the convention are rejected.

Pull Request Process
--------------------

1. Push your branch to your fork:

   .. code-block:: bash

       git push origin feat/my-feature

2. `Open a pull request <https://github.com/NanoForge-dev/actions/compare>`_
   against the ``main`` branch.

3. Ensure the CI pipeline passes (lint checks).

4. Request a review from a maintainer.

5. Once approved, the PR is merged into ``main``.

Code Style
----------

The project enforces consistent code style through ESLint and Prettier.

Naming conventions:

- **Files**: kebab-case (``generate-release-tree.ts``)
- **Functions**: camelCase (``generateReleaseTree``)
- **Interfaces**: PascalCase with ``I`` prefix for data types (``IPkg``)
- **Types**: PascalCase (``ReleaseEntry``)
- **Constants**: camelCase (``octokit``)

Import ordering (enforced by Prettier plugin):

1. External packages (``@actions/*``, ``commander``)
2. Relative imports (``./functions``)

Project Structure
-----------------

When adding code, follow the existing structure:

- **Actions**: ``src/<action-name>/`` with ``index.ts`` entry point
- **Shared functions**: Group by concern in the action directory
- **Types**: ``.d.ts`` or ``types.ts`` files alongside implementations

Adding a New Action
-------------------

1. Create a new directory under ``src/``:

   .. code-block:: text

       src/my-action/
       +-- index.ts     # Entry point with Commander setup
       +-- types.ts     # Type definitions (if needed)

2. Implement the action following the existing pattern:

   .. code-block:: typescript

       import { getInput, summary } from "@actions/core";
       import { program } from "commander";

       program
         .name("my action")
         .description("Description of my action")
         .argument("[arg]", "argument description", getInput("arg"))
         .option("--dry", "dry run", getBooleanInput("dry"))
         .parse();

       // Action logic...

       await summary.addHeading("My Action Summary").write();

3. Add a build entry in ``tsup.config.ts``:

   .. code-block:: typescript

       entry: ["src/my-action/index.ts"],
       outDir: "dist/my-action",

4. Create corresponding workflow files in ``.github/workflows/``.

5. Document the action in ``docs/docs/actions.rst``.

Dependencies
------------

Dependencies are managed through pnpm workspace version catalogs defined in
the root ``pnpm-workspace.yaml``. When adding or updating a dependency, use
the catalog reference rather than a direct version.

.. code-block:: json

    {
      "dependencies": {
        "@actions/core": "catalog:actions"
      }
    }

Reporting Issues
----------------

Report bugs and request features on the
`GitHub Issues <https://github.com/NanoForge-dev/actions/issues>`_ page.
Issue templates are available to guide your report.

Security
--------

For security vulnerabilities, refer to the ``SECURITY.md`` file in the
repository root for the responsible disclosure process.
