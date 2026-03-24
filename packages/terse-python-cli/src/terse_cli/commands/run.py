"""`terse run` command."""

from __future__ import annotations

from pathlib import Path

import click


@click.command("run", help="Execute a job's onTrigger with a serialized event JSON.")
@click.argument("job_name", required=False)
@click.option("--event", "event_json", metavar="JSON", help="Serialized event JSON string.")
@click.option(
    "--event-file",
    type=click.Path(path_type=Path, dir_okay=False),
    help="Path to a JSON file containing the serialized event.",
)
def run_command(job_name: str | None, event_json: str | None, event_file: Path | None) -> None:
    _ = (job_name, event_json, event_file)
    click.echo("Not yet implemented")
