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
- hand-written request/response models exported from `terse_sdk`

## Quick Start

```python
from terse_sdk import CronJobInputEvent, SdkAgentStreamEventFinalOutput, Terse
from terse_generated import Schedule, TerseAgent

app = Terse()

@app.job(
    name="example-job",
    triggers=[Schedule.cron("0 9 * * 1")],
    skills=[],
)
def run_job(event: CronJobInputEvent, agent: TerseAgent) -> None:
    prompt = (
        "Tell a joke"
        f"Context: {event.formatted_content}"
    )
    for stream_event in agent.run(prompt, event):
        if isinstance(stream_event, SdkAgentStreamEventFinalOutput):
            print(stream_event.final_output)
```

Trigger and skill configs come from the generated helpers in `terse_generated.py`. Run `terse init` and `terse generate` to scaffold a project.

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

## Recommended Path

If you want the full project workflow, install the CLI instead:

```bash
python -m pip install terse-cli
terse init my-terse-job
```

## Source

- Homepage: [useterse.ai](https://useterse.ai)
