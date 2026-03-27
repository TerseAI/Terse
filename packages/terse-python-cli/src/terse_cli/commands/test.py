"""`terse test` command."""

from __future__ import annotations

import logging

import click
from terse_sdk import CronJobInputEvent, TerseAgent, TriggerConfig, execute_registered_job

from .._loader import JobSelectionError, NoJobsFoundError, ProjectImportError, load_job_registry, resolve_job
from .._project import (
    ProjectRootError,
    format_missing_uv_install_message,
    is_uv_missing_result,
    read_api_key,
    run_ty_check,
)
from .._session import SessionStreamError, open_session_stream
from .._ui import PromptCancelledError, console, log_stream_event, prompt_select

LOGGER = logging.getLogger("terse.cli.test")


@click.command("test", help="Run a job locally against a synthetic cron event.")
@click.argument("job_name", required=False)
@click.option("--skip-type-check", is_flag=True, default=False, help="Skip ty type checking before running.")
def test_command(job_name: str | None, skip_type_check: bool) -> None:
    session = None

    try:
        project_dir, registry = load_job_registry()
        job = resolve_job(registry, job_name)
        cron_trigger = _resolve_cron_trigger(job.triggers)
    except (ProjectRootError, ProjectImportError, NoJobsFoundError, JobSelectionError, PromptCancelledError) as exc:
        raise click.ClickException(str(exc)) from exc

    console.print("")
    console.print(f"  [cyan]Testing job:[/cyan] {job.name}")
    console.print("")
    LOGGER.debug("Testing job %s", job.name)

    if not skip_type_check:
        console.print("  [dim]Running ty check...[/dim]")
        ty_result = run_ty_check(project_dir)
        if not ty_result.succeeded:
            if is_uv_missing_result(ty_result):
                raise click.ClickException(
                    f"{format_missing_uv_install_message(('uv', 'sync'))}\n"
                    "Once dependencies are installed, rerun `terse test`."
                )
            if ty_result.details:
                console.print(ty_result.details)
            raise click.ClickException("Type check failed. Fix the errors above before running.")
        console.print("")

    api_key = read_api_key(project_dir)
    if api_key:
        try:
            session = open_session_stream(api_key, log_stream_event)
        except SessionStreamError as exc:
            console.print(f"  [yellow]Warning:[/yellow] {exc}")
    else:
        console.print("  [dim]No TERSE_API_KEY found; running locally without session logging.[/dim]")

    try:
        synthetic_event = _build_synthetic_cron_event(cron_trigger)
        LOGGER.debug("Synthetic cron event:\n%s", synthetic_event.model_dump_json(indent=2))
        skipped = execute_registered_job(
            job,
            synthetic_event,
            agent=TerseAgent(job.skills, session_id=session.session_id if session else None),
        )
    except Exception as exc:
        raise click.ClickException(f'Job "{job.name}" threw an error.\n\n{exc}') from exc
    finally:
        if session is not None:
            session.close()

    if skipped:
        console.print(f'  [dim]Job "{job.name}" skipped (filter returned false).[/dim]')
        console.print("")
        return

    console.print(f'  [green]Job "{job.name}" completed successfully.[/green]')
    console.print("")


def _resolve_cron_trigger(triggers: list[TriggerConfig]) -> TriggerConfig:
    cron_triggers = [trigger for trigger in triggers if trigger.integration_type == "cron_job"]
    if not cron_triggers:
        raise click.ClickException("No cron triggers found for this job.")

    if len(cron_triggers) == 1:
        return cron_triggers[0]

    return prompt_select(
        "Multiple cron triggers found. Which one?",
        [(_cron_trigger_label(trigger), trigger) for trigger in cron_triggers],
    )


def _build_synthetic_cron_event(trigger: TriggerConfig) -> CronJobInputEvent:
    expression = str(trigger.config.get("cronExpression") or "unknown")
    return CronJobInputEvent(
        event_type="manual",
        formatted_content=(f"This is a manually triggered event for a cron trigger (schedule: {expression})."),
        debug_log="Manual Trigger",
    )


def _cron_trigger_label(trigger: TriggerConfig) -> str:
    expression = str(trigger.config.get("cronExpression") or "unknown")
    return f"cron_job - {expression}"
