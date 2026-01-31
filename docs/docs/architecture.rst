Architecture
============

Overview
--------

NanoForge Actions is a collection of GitHub Actions designed to automate the
release workflow for NanoForge monorepo packages. It provides three main actions
that handle different stages of the release process:

1. **create-release-pr** -- Creates a release pull request with version bumps
   and changelog generation
2. **release-packages** -- Publishes packages to npm with proper dependency
   sequencing
3. **create-release-tag** -- Creates git tags after a release PR is merged

The package is published to npm as ``@nanoforge-dev/actions`` and is built
using tsup with ESM output.

Technology Stack
----------------

.. list-table::
   :header-rows: 1
   :widths: 30 70

   * - Component
     - Technology
   * - Language
     - TypeScript (strict mode)
   * - Runtime
     - Bun / Node.js 25
   * - CLI Framework
     - Commander.js
   * - GitHub Integration
     - @actions/core, @actions/github
   * - Build Tool
     - tsup (esbuild-based bundler)
   * - Module Format
     - ESM
   * - Target
     - ES2022
   * - Package Manager
     - pnpm 10.x
   * - Linter
     - ESLint 9.x
   * - Formatter
     - Prettier 3.x
   * - CI/CD
     - GitHub Actions

Project Structure
-----------------

::

    src/
    +-- create-release-pr/              # Pre-release action
    |   +-- index.ts                    # Entry point
    |   +-- functions.ts                # Core functions
    |   +-- types.ts                    # Type definitions
    +-- release-packages/               # Package publishing action
    |   +-- index.ts                    # Entry point
    |   +-- generate-release-tree.ts    # Dependency tree generation
    |   +-- release-package.ts          # Individual package release
    +-- create-release-tag/             # Tag creation action
        +-- index.ts                    # Entry point

Action Pattern
--------------

Each action follows a consistent pattern:

1. **Input Parsing** -- Uses Commander.js to parse CLI arguments combined with
   ``@actions/core`` for GitHub Actions inputs
2. **Package Resolution** -- Uses pnpm to query the monorepo workspace for
   package information
3. **Dependency Analysis** -- Builds a release tree respecting inter-package
   dependencies
4. **Execution** -- Performs the action (publish, PR creation, or tagging)
5. **Summary** -- Generates a GitHub Actions job summary using ``@actions/core``

.. code-block:: typescript

    // Typical action structure
    import { getInput, summary } from "@actions/core";
    import { program } from "commander";

    program
      .name("action-name")
      .description("Action description")
      .argument("[package]", "target package", getInput("package"))
      .option("--dry", "dry run mode", getBooleanInput("dry"))
      .parse();

    const { dry } = program.opts();
    const [packageName] = program.processedArgs;

    // Action logic...

    await summary.addHeading("Summary").write();

Release Tree Algorithm
----------------------

The ``release-packages`` action uses a dependency-aware release algorithm:

1. **Discovery** -- Query pnpm for all workspace packages
2. **Tree Construction** -- Build a directed acyclic graph (DAG) of package
   dependencies
3. **Topological Sort** -- Order packages so dependencies are released before
   dependents
4. **Parallel Execution** -- Release independent packages in parallel within
   each tree level

.. code-block:: text

    Level 0: [package-a, package-b]     (no internal deps)
    Level 1: [package-c]                (depends on a)
    Level 2: [package-d, package-e]     (depend on c)

This ensures that when ``package-d`` is published, its dependency ``package-c``
is already available on npm.

Build Pipeline
--------------

The project uses ``tsup`` for bundling. The build produces:

- ESM bundles for each action entry point
- Type declarations (``.d.ts``)
- Source maps

.. code-block:: bash

    # Full build
    pnpm run build

    # What happens internally:
    # 1. tsc --noEmit        (type checking)
    # 2. tsup                (bundling)

GitHub Actions Integration
--------------------------

Actions are consumed via the ``uses`` directive in workflow files:

.. code-block:: yaml

    - name: Release packages
      uses: ./dist/release-packages
      with:
        package: "@nanoforge-dev/actions"
        dry: false
      env:
        NODE_AUTH_TOKEN: ${{ secrets.NPM_PUBLISH_TOKEN }}
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

Each action reads inputs from both:

- GitHub Actions ``with`` parameters (via ``getInput()``)
- CLI arguments (via Commander.js)

This dual-mode design allows actions to be used both in CI and locally for
testing.
