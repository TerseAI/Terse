"""Click entry point for the Terse Python CLI."""

from __future__ import annotations

import click

from . import __version__
from .commands import deploy_command, generate_command, init_command, integrate_command, run_command, test_command


@click.group(help="The Terse CLI - scaffold and manage Terse projects.")
@click.version_option(__version__, prog_name="terse")
def cli() -> None:
    """Run the Terse command line interface."""


cli.add_command(init_command)
cli.add_command(generate_command)
cli.add_command(integrate_command)
cli.add_command(run_command)
cli.add_command(test_command)
cli.add_command(deploy_command)
