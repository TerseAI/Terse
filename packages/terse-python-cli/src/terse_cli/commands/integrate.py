"""`terse integrate` command."""

from __future__ import annotations

import click

from .._http import frontend_url
from .._ui import console


@click.command("integrate", help="Open the integrations page in the Terse Web UI.")
def integrate_command() -> None:
    integrations_url = f"{frontend_url()}/app/integrations"

    console.print("")
    console.print(f"  Open integrations in the Web UI: [cyan]{integrations_url}[/cyan]")
    console.print("")

    if click.launch(integrations_url):
        console.print("  [green]Opened in your default browser.[/green]")
        return

    console.print("  [yellow]Could not open browser automatically.[/yellow]")
    console.print(f"  Open manually: [cyan]{integrations_url}[/cyan]")
