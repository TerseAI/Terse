# terse-python-sdk

Python SDK foundation for building jobs on the [Terse](https://useterse.ai) platform.

## Installation

```bash
uv add terse-python-sdk
```

## Local Development

This SDK is intended to be developed from the repo root alongside `terse-python-cli`.

### Prerequisites

- `uv`
- Python `>=3.11`

If needed:

```bash
brew install uv
uv python install 3.11
```

### Bootstrap the workspace

From the repo root, sync the uv workspace so the CLI and SDK install together:

```bash
npm run python:setup
```

This will:

- copy the repo-level TypeScript shared definitions into `packages/terse-python-sdk/shared/`
- regenerate the Pydantic models under `src/terse_sdk/generated/`
- create `.venv/` at the repo root
- install both Python packages in editable mode
- install shared dev tools

If you only need to refresh mirrored shared types and generated models:

```bash
npm run python:refresh-types
```

## What's Included

- Generated Pydantic models under `terse_sdk.generated.models`
- Typed settings in `terse_sdk.models.config`
- Event and job config models in `terse_sdk.models`
- A runtime registration API with `Terse`, `@app.job(...)`, and `TerseAgent`
- A local uv workspace link so the CLI can consume the SDK without publishing it first

## Quick Start

```python
from terse_sdk import CronJobInputEvent, Terse, TerseAgent
from terse_generated import Schedule

app = Terse()

@app.job(
    name="example-job",
    triggers=[Schedule.cron("0 9 * * 1")],
    skills=[],
)
def example(event: CronJobInputEvent, agent: TerseAgent) -> None:
    _ = agent
    print(event.formatted_content)

example(
    CronJobInputEvent(
        event_type="manual",
        formatted_content="Manual local run",
        debug_log="README example",
    ),
    TerseAgent(),
)
```

`TriggerConfig` and `SkillConfig` are low-level transport models. In normal project code, use the generated helpers in `terse_generated.py` instead of constructing those DTOs by hand.

You can also smoke-test the installed SDK from the repo root:

```bash
uv run --package terse-python-sdk python - <<'PY'
from terse_sdk import CronJobInputEvent, Terse, TerseAgent

app = Terse()

@app.job(name="demo-job")
def demo(event: CronJobInputEvent, agent: TerseAgent) -> None:
    _ = agent
    print(event.formatted_content)

demo(
    CronJobInputEvent(
        event_type="manual",
        formatted_content="hello",
        debug_log="demo",
    ),
    TerseAgent(),
)
PY
```

## Shared Type Codegen

The SDK includes generated Pydantic models based on the TypeScript shared type definitions in this repo.

Regenerate them from the repo root with:

```bash
npm run python:refresh-types
```

Generated files live in:

- `packages/terse-python-sdk/src/terse_sdk/generated/`
- `packages/terse-python-sdk/shared/`
- `packages/terse-python-cli/shared/`

Typical times to rerun codegen:

- a shared TypeScript type changed under `shared/`
- the Python generated models need to match new backend/frontend/shared contracts
- you changed the generation script itself

After codegen, validate the SDK again:

```bash
npm run python:check
```

## Astral Tooling

Run all commands from the repo root.

Convenience wrappers:

```bash
npm run python:setup
npm run python:refresh-types
npm run python:check
npm run python:build
```

### Dependency sync and lock

```bash
uv sync --all-packages
uv lock
uv sync --all-packages
```

### Refresh mirrored TypeScript shared types and generated models

```bash
npm run sync:shared
npm run python:refresh-types
```

Use `npm run sync:shared` when you only want to mirror the raw TypeScript `shared/` tree into the Python packages.

Use `npm run python:refresh-types` when you want the full Python type-refresh flow.

### Linting with Ruff

```bash
uv run ruff check packages/terse-python-sdk/src
uv run ruff check --fix packages/terse-python-sdk/src
```

### Formatting with Ruff

```bash
uv run ruff format packages/terse-python-sdk/src
uv run ruff format --check packages/terse-python-sdk/src
```

### Type checking with ty

```bash
uv run ty check packages/terse-python-sdk/src
```

### Building with uv

Build only the SDK:

```bash
uv build --package terse-python-sdk
```

Build the whole Python workspace:

```bash
npm run python:build
```

When you run `uv build --package ...` from the repo root, build artifacts are written to the repo-level `dist/` directory.

## Working on the SDK Together with the CLI

The SDK and CLI are intentionally linked through the uv workspace so they can evolve in the same branch.

Normal workflow:

1. Run `npm run python:setup`.
2. Update SDK code in `packages/terse-python-sdk/src/terse_sdk/`.
3. If shared TS definitions changed, run `npm run python:refresh-types`.
4. Run `uv run ruff check packages/terse-python-sdk/src`.
5. Run `uv run ruff format --check packages/terse-python-sdk/src`.
6. Run `uv run ty check packages/terse-python-sdk/src`.
7. If the CLI depends on the change, manually exercise it with:
   `uv run --package terse-python-cli terse --help`
8. Run `npm run python:check` for the full Python validation pass.
9. Build with `npm run python:build`.

## Package Layout

Key directories:

- `src/terse_sdk/` for importable SDK code
- `src/terse_sdk/models/` for hand-written Python models
- `src/terse_sdk/generated/` for generated Pydantic models
- `shared/` for the mirrored repo-level TypeScript shared definitions
- `pyproject.toml` for package metadata and build config
