"""`terse deploy` command."""

from __future__ import annotations

import click


@click.command("deploy", help="Deploy all jobs to Terse (syncs with server; removed jobs are deleted).")
def deploy_command() -> None:
    click.echo("Not yet implemented")
