"""`terse run` command."""

from __future__ import annotations

import json
from pathlib import Path

import click
from pydantic import ValidationError
from terse_sdk import AnyInputEvent, TerseAgent, deserialize_input_event, execute_registered_job

from .._loader import JobSelectionError, NoJobsFoundError, ProjectImportError, load_job_registry, resolve_job
from .._project import ProjectRootError, assert_project_root
from .._ui import PromptCancelledError, console


@click.command("run", help="Execute a job's onTrigger with a serialized event JSON.")
@click.argument("job_name", required=False)
@click.option("--event", "event_json", metavar="JSON", help="Serialized event JSON string.")
@click.option(
    "--event-file",
    type=click.Path(path_type=Path, dir_okay=False),
    help="Path to a JSON file containing the serialized event.",
)
def run_command(job_name: str | None, event_json: str | None, event_file: Path | None) -> None:
    try:
        assert_project_root(Path.cwd())
        input_event = _load_input_event(event_json, event_file)
        _, registry = load_job_registry(Path.cwd())
        job = resolve_job(registry, job_name)
    except (ProjectRootError, ProjectImportError, NoJobsFoundError, JobSelectionError, PromptCancelledError) as exc:
        raise click.ClickException(str(exc)) from exc

    console.print("")
    console.print(f"  [cyan]Running job:[/cyan] {job.name}")
    console.print("")

    try:
        skipped = execute_registered_job(job, input_event, agent=TerseAgent(job.skills))
    except Exception as exc:
        raise click.ClickException(f'Job "{job.name}" threw an error.\n\n{exc}') from exc

    if skipped:
        console.print(f'  [dim]Job "{job.name}" skipped (filter returned false).[/dim]')
        console.print("")
        return

    console.print(f'  [green]Job "{job.name}" completed successfully.[/green]')
    console.print("")


def _load_input_event(event_json: str | None, event_file: Path | None) -> AnyInputEvent:
    raw_event_json = _resolve_event_json(event_json, event_file)
    try:
        payload = json.loads(raw_event_json)
    except json.JSONDecodeError as exc:
        raise click.ClickException("--event value is not valid JSON.") from exc

    if not isinstance(payload, dict):
        raise click.ClickException("Serialized event JSON must be an object.")

    try:
        return deserialize_input_event(payload)
    except ValidationError as exc:
        raise click.ClickException(f"Serialized event JSON is invalid.\n\n{exc}") from exc


def _resolve_event_json(event_json: str | None, event_file: Path | None) -> str:
    if event_json:
        return event_json

    if event_file:
        try:
            return event_file.read_text(encoding="utf-8")
        except OSError as exc:
            raise click.ClickException(f"Could not read event file: {event_file}\n\n{exc}") from exc

    raise click.ClickException(
        "--event <json> or --event-file <path> is required.\n\n"
        'Usage: terse run --event \'{"integrationType":"...","formattedContent":"...","debugLog":"..."}\'\n'
        "       terse run --event-file ./event.json\n"
        "Tip:   Use `terse test` to interactively pick a sample event."
    )
