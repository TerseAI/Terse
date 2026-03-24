# terse-python-cli

Python CLI for scaffolding, generating, testing, and deploying [Terse](https://useterse.ai) jobs.

## Installation

```bash
python -m pip install terse-python-cli
```

The CLI installs the published `terse-python-sdk` automatically.

## Requirements

- Python `>=3.11`
- [`uv`](https://docs.astral.sh/uv/) for working with scaffolded projects

The CLI itself can be installed with `pip`, but the generated project scaffold uses `uv sync` and `uv run`.

## Quick Start

```bash
terse init my-terse-job
cd my-terse-job
uv sync
uv run python src/main.py
```

If you connect integrations later, regenerate the project helpers:

```bash
terse generate
```

## Commands

- `terse init [PROJECT_NAME]`
- `terse generate`
- `terse integrate`
- `terse run [JOB_NAME] --event ... --event-file ...`
- `terse test [JOB_NAME]`
- `terse deploy`

## Supported Generated Helpers

The current Python codegen surface is intentionally small:

- `Schedule.cron(...)`
- `Attio.skill(...)`
- `Snowflake.skill(...)`

`terse generate` writes these helpers into `src/terse_generated.py` inside your project.

## Environment Variables

- `TERSE_API_KEY`: required for `terse generate`, `terse deploy`, and any agent/tool calls made by your job
- `TERSE_BACKEND_URL`: optional backend override for local development
- `TERSE_FRONTEND_URL`: optional frontend override for local development

## Typical Workflow

```bash
terse init my-terse-job
cd my-terse-job
uv sync
uv run python src/main.py
terse test
terse deploy
```

To run a job against a serialized event:

```bash
terse run --event '{"integrationType":"cron_job","eventType":"manual","formattedContent":"Manual trigger","debugLog":"Manual trigger"}'
```

## Source

- Homepage: [useterse.ai](https://useterse.ai)
- Repository: [github.com/TerseAI/Terse](https://github.com/TerseAI/Terse)
- Issues: [github.com/TerseAI/Terse/issues](https://github.com/TerseAI/Terse/issues)

## Development

If you are working on the CLI itself from the monorepo:

```bash
npm run python:setup
npm run python:check
npm run python:build
```
