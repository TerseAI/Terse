"""`terse integrate` command."""

from __future__ import annotations

import click


@click.command("integrate", help="Open the integrations page in the Terse Web UI.")
def integrate_command() -> None:
    click.echo("Not yet implemented")
