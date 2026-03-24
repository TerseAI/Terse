"""`terse test` command."""

from __future__ import annotations

import click


@click.command("test", help="Fetch sample events and run a job interactively.")
@click.argument("job_name", required=False)
def test_command(job_name: str | None) -> None:
    _ = job_name
    click.echo("Not yet implemented")
