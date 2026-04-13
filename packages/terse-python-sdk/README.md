# terse-sdk

Python SDK for building jobs on the [Terse](https://useterse.ai) platform.

Most users should start with `terse-cli`, which scaffolds a project and generates `terse_generated.py` helpers for the current trigger and skill surface.

## Installation

```bash
python -m pip install terse-sdk
```

## Runtime API

The SDK provides:

- `Terse` for runtime job registration
- `@app.job(...)` for declaring jobs
- `TerseAgent` for agent runs and deterministic tool execution
- typed trigger event models such as `CronTrigger`
- hand-written request/response models exported from `terse_sdk`

## Quick Start

```python
from terse_sdk import CronTrigger, FinalOutput, Terse
from terse_generated import Schedule, TerseAgent

app = Terse()

@app.job(
    name="example-job",
    triggers=[Schedule.cron("0 9 * * 1")],
    skills=[],
)
def run_job(event: CronTrigger, agent: TerseAgent) -> None:
    prompt = (
        "Tell a joke"
        f"Context: {event.formatted_content}"
    )
    for stream_event in agent.run(prompt, event):
        if isinstance(stream_event, FinalOutput):
            print(stream_event.final_output)
```

Trigger and skill configs come from the generated helpers in `terse_generated.py`. Run `terse init` and `terse generate` to scaffold a project.

## Generated Helpers

The SDK package does not generate project helpers by itself.

If you scaffold a project with `terse init` and then run `terse generate`, your project gets `src/terse_generated.py` with helpers such as:

- `Schedule.cron(...)`
- GitHub triggers plus `GitHub.skill(...)` and generated `GitHubRepo.*` constants
- `Attio.skill(...)`
- Slack triggers/skills plus generated `SlackChannel.*` constants
- `Snowflake.skill(...)`
- deterministic wrappers on `agent.tools.attio`, `agent.tools.slack`, and `agent.tools.snowflake`

GitHub parity in Python currently means generated trigger builders and `GitHub.skill(...)` for model-visible repo access. It does not include deterministic `agent.tools.github.*` wrappers.

Example inside a generated project:

```python
from terse_generated import Schedule, Snowflake, TerseAgent
from terse_sdk import CronTrigger, Terse

app = Terse()

@app.job(
    name="snowflake-job",
    triggers=[Schedule.cron("0 9 * * 1")],
    skills=[Snowflake.skill()],
)
def example(event: CronTrigger, agent: TerseAgent) -> None:
    result = agent.tools.snowflake.execute_query(query="select current_date()")
    print(result)
```

## Local Development

To test local changes to the SDK in a Terse project, you need to add a uv source override so the resolver uses your local copy instead of PyPI.

From your project directory, run:

```bash
link-terse-py
```

This adds a `[tool.uv.sources]` entry to your `pyproject.toml` pointing at the local SDK and runs `uv sync`:

```toml
[tool.uv.sources]
terse-sdk = { path = "/path/to/Terse/packages/terse-python-sdk", editable = true }
```

To revert back to the published PyPI version:

```bash
unlink-terse-py
```

> **Why not `uv pip install -e`?** uv manages dependencies declaratively from `pyproject.toml` + `uv.lock`. An imperative `uv pip install -e` gets overwritten the next time `uv sync` or `uv run` re-resolves from the lockfile. The source override tells uv's resolver itself to use the local path, so it persists across syncs.

## Environment Variables

- `TERSE_API_KEY`: required for agent runs and deterministic tool execution

## Recommended Path

If you want the full project workflow, install the CLI instead:

```bash
python -m pip install terse-cli
terse init my-terse-job
```

## Source

- Homepage: [useterse.ai](https://useterse.ai)
