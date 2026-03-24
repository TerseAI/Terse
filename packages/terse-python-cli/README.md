# terse-python-cli

Python CLI for scaffolding, developing, testing, and deploying [Terse](https://useterse.ai) jobs.

## Status

This package is currently a skeleton. The command tree, entrypoint wiring, options, and package linking are in place, but the command bodies still return `Not yet implemented`.

## Complete Local Dev Setup

The CLI is meant to be developed from the monorepo root, not as a completely standalone package.

### Prerequisites

- `uv` installed locally
- Python `>=3.11`

If needed:

```bash
brew install uv
uv python install 3.11
```

### Bootstrap the Python workspace

From the repo root:

```bash
npm run python:setup
```

This creates a root `.venv` and installs:

- `terse-python-cli`
- `terse-python-sdk`
- dev tools like `ruff` and `ty`
- a mirrored `shared/` directory inside this package containing the repo-level TypeScript shared definitions

Because the CLI depends on the SDK via the uv workspace, this is the normal local setup for working on both together.

If you only need to refresh shared TypeScript definitions and generated Python artifacts:

```bash
npm run python:refresh-types
```

## Manual CLI Runs

From the repo root, use uv to execute the CLI entrypoint:

```bash
uv run --package terse-python-cli terse --help
uv run --package terse-python-cli terse --version
```

If you want the repo-level shortcut that refreshes shared types first and then runs a quick CLI smoke test:

```bash
npm run python:smoke
```

Useful manual checks:

```bash
uv run --package terse-python-cli terse init --help
uv run --package terse-python-cli terse run --help
uv run --package terse-python-cli terse test --help
uv run --package terse-python-cli terse deploy --help
```

### Current end-to-end manual test flow

Since the commands are still stubs, the current E2E test is about validating the package wiring and CLI interface:

```bash
uv run --package terse-python-cli terse init demo-project
uv run --package terse-python-cli terse generate
uv run --package terse-python-cli terse integrate
uv run --package terse-python-cli terse test demo-job
uv run --package terse-python-cli terse deploy
uv run --package terse-python-cli terse run demo-job --event '{"integrationType":"terse","eventType":"manual","formattedContent":"Manual trigger","debugLog":"Manual trigger"}'
```

What this verifies today:

- the `terse` console script is installed
- Click command registration is correct
- argument and option parsing is correct
- the CLI can resolve the local `terse-python-sdk` package
- command execution reaches the stub implementation

If you want to use the synced virtualenv directly:

```bash
./.venv/bin/terse --help
```

## Commands

- `terse init [PROJECT_NAME]`
- `terse generate`
- `terse integrate`
- `terse run [JOB_NAME] --event ... --event-file ...`
- `terse test [JOB_NAME]`
- `terse deploy`

## Astral Tooling

Run all commands from the repo root.

### Dependency sync and lock

```bash
uv sync --all-packages
uv lock
uv sync --all-packages
```

Use `uv lock` when dependencies change. Use `uv sync --all-packages` to update the local environment from the workspace and lockfile.

Convenience wrappers:

```bash
npm run python:setup
npm run python:check
npm run python:build
```

### Refresh mirrored TypeScript shared types

```bash
npm run sync:shared
npm run python:refresh-types
```

`npm run sync:shared` updates the package-local `shared/` mirror.

`npm run python:refresh-types` does that plus regenerates the Python SDK Pydantic models, which is the command you usually want.

### Linting with Ruff

```bash
uv run ruff check packages/terse-python-cli/src
uv run ruff check --fix packages/terse-python-cli/src
```

### Formatting with Ruff

```bash
uv run ruff format packages/terse-python-cli/src
uv run ruff format --check packages/terse-python-cli/src
```

### Type checking with ty

```bash
uv run ty check packages/terse-python-cli/src
```

### Building with uv

Build just the CLI package:

```bash
uv build --package terse-python-cli
```

Build all Python workspace packages:

```bash
npm run python:build
```

When you run `uv build --package ...` from the repo root, build artifacts are written to the repo-level `dist/` directory.

## Overall Development Workflow

For normal CLI work:

1. Run `npm run python:setup`.
2. Make CLI changes in `packages/terse-python-cli/src/terse_cli/`.
3. If the CLI needs SDK changes, update `packages/terse-python-sdk` in the same branch.
4. If repo-level TypeScript shared definitions changed, run `npm run python:refresh-types`.
5. Run Ruff:
   `uv run ruff check packages/terse-python-cli/src`
6. Run formatting:
   `uv run ruff format --check packages/terse-python-cli/src`
7. Run type checking:
   `uv run ty check packages/terse-python-cli/src`
8. Manually exercise the command you changed with `uv run --package terse-python-cli terse ...`.
9. Run `npm run python:check` before finishing larger changes.
10. Build with `npm run python:build`.

## Relationship to the SDK

The CLI is linked to the local SDK through the uv workspace:

- dependency source is defined in `packages/terse-python-cli/pyproject.toml`
- the SDK package is resolved from the same repo checkout during local development
- shared TypeScript definitions are mirrored into `packages/terse-python-cli/shared/`

That means CLI and SDK changes can be developed together without publishing intermediate packages.
