# terse-cli

Python CLI for scaffolding, generating, testing, and deploying [Terse](https://useterse.ai) jobs.

## Installation

Install the CLI itself with `pipx`:

```bash
pipx install terse-cli
```

The CLI installs the published `terse-sdk` automatically.

> Don't have pipx? Install it first:
>
> ```bash
> # macOS
> brew install pipx && pipx ensurepath
>
> # Ubuntu/Debian
> sudo apt install pipx && pipx ensurepath
>
> # Generic
> python3 -m pip install --user pipx && python3 -m pipx ensurepath
> ```
>
> Then restart your shell.

## Prerequisites

- Python `>=3.11`
- [`uv`](https://docs.astral.sh/uv/getting-started/installation/) for scaffolded project dependency management and local commands

`pipx install terse-cli` gives you the `terse` command, but generated Terse Python projects still expect `uv` to be available on your `PATH` for commands like `uv sync` and `uv run`.

If you do not already have `uv`, install it from the official Astral instructions. For example on macOS:

```bash
brew install uv
```

## Quick Start

```bash
terse init my-terse-job
cd my-terse-job
uv sync
terse test
```

If `terse init` could not install dependencies automatically, install `uv` if needed and rerun:

```bash
uv sync
```

If you connect integrations later, regenerate the project helpers:

```bash
terse generate
```

## Commands

- `terse init [PROJECT_NAME]`
- `terse generate`
- `terse integrate`
- `terse test [JOB_NAME]`
- `terse deploy`

## Supported Generated Helpers

The current Python codegen surface is:

- `Schedule.cron(...)`
- `Attio.skill(...)`
- `Snowflake.skill(...)`
- deterministic wrappers on `agent.tools.attio` and `agent.tools.snowflake`

`terse generate` writes these helpers into `src/terse_generated.py` inside your project.

For example, after generating Snowflake helpers and registering `skills=[Snowflake.skill()]`, a job can call:

```python
from terse_sdk import CronJobInputEvent
from terse_generated import TerseAgent

def handle(event: CronJobInputEvent, agent: TerseAgent) -> None:
    result = agent.tools.snowflake.execute_query(query="select current_date()")
    print(result.rowCount)
```

## Environment Variables

- `TERSE_API_KEY`: required for `terse generate`, `terse deploy`, and any agent/tool calls made by your job

## Typical Workflow

```bash
terse init my-terse-job
cd my-terse-job
uv sync
terse test
terse deploy
```

## Source

- Homepage: [useterse.ai](https://useterse.ai)
