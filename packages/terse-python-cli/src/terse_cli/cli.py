"""Click entry point for the Terse Python CLI."""

from __future__ import annotations

import click

from . import __version__
from ._debug import configure_debug_logging
from .commands import deploy_command, generate_command, init_command, integrate_command, run_command, test_command


@click.group(help="The Terse CLI - scaffold and manage Terse projects.")
@click.option("--debug", is_flag=True, envvar="TERSE_DEBUG", help="Enable debug logging.")
@click.version_option(__version__, prog_name="terse")
def cli(debug: bool) -> None:
    """Run the Terse command line interface."""

    configure_debug_logging(debug)


cli.add_command(init_command)
cli.add_command(generate_command)
cli.add_command(integrate_command)
cli.add_command(run_command)
cli.add_command(test_command)
cli.add_command(deploy_command)
