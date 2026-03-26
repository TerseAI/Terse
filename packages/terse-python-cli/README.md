# terse-cli

Python CLI for scaffolding, generating, testing, and deploying [Terse](https://useterse.ai) jobs.

## Installation

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

## Requirements

- Python `>=3.11`
- [`uv`](https://docs.astral.sh/uv/) for working with scaffolded projects

The CLI is installed via pipx, but the generated project scaffold uses `uv sync` and `uv run`.

## Quick Start

```bash
terse init my-terse-job
cd my-terse-job
uv sync
terse test
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
