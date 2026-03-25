# terse-sdk

Python SDK for building jobs on the [Terse](https://useterse.ai) platform.

Most users should start with `terse-cli`, which scaffolds a project and generates `terse_generated.py` helpers for the currently supported trigger and skill surface.

## Installation

```bash
python -m pip install terse-sdk
```

## Runtime API

The SDK provides:

- `Terse` for runtime job registration
- `@app.job(...)` for declaring jobs
- `TerseAgent` for agent runs and deterministic tool execution
- typed event models such as `CronJobInputEvent`
- generated backend models under `terse_sdk.generated.models`

## Quick Start

```python
from terse_sdk import CronJobInputEvent, EventType, Terse, TerseAgent

app = Terse()

@app.job(
    name="example-job",
    triggers=[],
    skills=[],
)
def example(event: CronJobInputEvent, agent: TerseAgent) -> None:
    for stream_event in agent.run(
        "Answer with one short, cute sentence about this cron job.",
        event,
    ):
        if stream_event.type == EventType.FINAL_OUTPUT:
            print(stream_event.finalOutput)

example(
    CronJobInputEvent(
        event_type="manual",
        formatted_content="Manual local run",
        debug_log="README example",
    ),
    TerseAgent(),
)
```

That example is intentionally self-contained. In a real Terse project, trigger and skill configs normally come from the generated helpers in `terse_generated.py`, not from manually constructing low-level DTOs.

## Generated Helpers

The SDK package does not generate project helpers by itself.

If you scaffold a project with `terse init` and then run `terse generate`, your project gets `src/terse_generated.py` with the currently supported helpers:

- `Schedule.cron(...)`
- `Attio.skill(...)`
- `Snowflake.skill(...)`
- deterministic wrappers on `agent.tools.attio` and `agent.tools.snowflake`

Example inside a generated project:

```python
from terse_generated import Schedule, Snowflake, TerseAgent
from terse_sdk import CronJobInputEvent, Terse

app = Terse()

@app.job(
    name="snowflake-job",
    triggers=[Schedule.cron("0 9 * * 1")],
    skills=[Snowflake.skill()],
)
def example(event: CronJobInputEvent, agent: TerseAgent) -> None:
    result = agent.tools.snowflake.execute_query(query="select current_date()")
    print(result)
```

## Environment Variables

- `TERSE_API_KEY`: required for agent runs and deterministic tool execution
- `TERSE_BACKEND_URL`: optional backend override for local development
- `TERSE_FRONTEND_URL`: optional frontend override for local development

## Recommended Path

If you want the full project workflow, install the CLI instead:

```bash
python -m pip install terse-cli
terse init my-terse-job
```

## Source

- Homepage: [useterse.ai](https://useterse.ai)
- Repository: [github.com/TerseAI/Terse](https://github.com/TerseAI/Terse)
- Issues: [github.com/TerseAI/Terse/issues](https://github.com/TerseAI/Terse/issues)

## Development

If you are working on the SDK itself from the monorepo:

```bash
npm run python:setup
npm run python:check
npm run python:build
```
