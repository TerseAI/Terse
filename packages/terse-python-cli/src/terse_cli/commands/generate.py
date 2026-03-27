"""`terse generate` command."""

from __future__ import annotations

from pathlib import Path

import click

from .._generate import MissingApiKeyError, generate_project
from .._http import ApiRequestError, AuthenticationError
from .._project import ProjectRootError
from .._ui import console


@click.command("generate", help="Generate types for your connected integrations.")
def generate_command() -> None:
    try:
        with console.status("Fetching integrations...") as status:
            result = generate_project(Path.cwd(), on_phase=status.update)
    except ProjectRootError as exc:
        raise click.ClickException(str(exc)) from exc
    except MissingApiKeyError as exc:
        raise click.ClickException(str(exc)) from exc
    except AuthenticationError as exc:
        raise click.ClickException(
            "Authentication failed: your TERSE_API_KEY was rejected.\nUpdate TERSE_API_KEY in .env and try again."
        ) from exc
    except ApiRequestError as exc:
        raise click.ClickException(str(exc)) from exc

    click.echo("")
    for line in result.summary_lines:
        click.echo(f"  + {line}")
    click.secho(f"\nGenerated {result.output_path.relative_to(result.project_dir)}", fg="green")
