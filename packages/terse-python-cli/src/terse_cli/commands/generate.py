"""`terse generate` command."""

from __future__ import annotations

import click


@click.command("generate", help="Generate types for your connected integrations.")
def generate_command() -> None:
    click.echo("Not yet implemented")
