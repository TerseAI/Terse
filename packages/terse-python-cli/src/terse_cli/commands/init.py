"""`terse init` command."""

from __future__ import annotations

import click


@click.command("init", help="Scaffold a new Terse project.")
@click.argument("project_name", required=False)
def init_command(project_name: str | None) -> None:
    _ = project_name
    click.echo("Not yet implemented")
