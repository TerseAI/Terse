"""`terse deploy` command."""

from __future__ import annotations

import click
from pydantic import ValidationError
from terse_sdk import (
    RegisteredJob,
    SdkDeployJob,
    SdkDeployRequestBody,
    SdkDeployResponseBody,
    SdkDeployTrigger,
    TriggerConfig,
)

from .._http import ApiRequestError, AuthenticationError, request_json
from .._loader import NoJobsFoundError, ProjectImportError, load_job_registry
from .._package import PackagingError, build_deploy_archive
from .._project import ProjectRootError, assert_project_root, read_api_key
from .._ui import console


@click.command("deploy", help="Deploy all jobs to Terse (syncs with server; removed jobs are deleted).")
def deploy_command() -> None:
    try:
        project_dir = assert_project_root()
        api_key = read_api_key(project_dir)
        if not api_key:
            raise click.ClickException(
                "No TERSE_API_KEY found in .env.\n"
                "Run `terse init` to set up your project, or add TERSE_API_KEY to your .env file."
            )

        _, registry = load_job_registry(project_dir)
        archive = build_deploy_archive(project_dir)
        jobs = list(registry.values())

        with console.status(f"Deploying {len(jobs)} job{'s' if len(jobs) != 1 else ''}..."):
            payload = request_json(
                "/sdk/deploy",
                api_key,
                method="POST",
                params=SdkDeployRequestBody(
                    jobs=[_serialize_job(job) for job in jobs],
                    sourceZipBase64=archive.source_zip_base64,
                ).model_dump(exclude_none=True),
            )

        response = SdkDeployResponseBody.model_validate(payload)
    except (ProjectRootError, ProjectImportError, NoJobsFoundError, PackagingError) as exc:
        raise click.ClickException(str(exc)) from exc
    except AuthenticationError as exc:
        raise click.ClickException(
            "Authentication failed: your TERSE_API_KEY was rejected.\nUpdate TERSE_API_KEY in .env and try again."
        ) from exc
    except ApiRequestError as exc:
        raise click.ClickException(str(exc)) from exc
    except ValidationError as exc:
        raise click.ClickException(f"Received an invalid deploy response.\n\n{exc}") from exc

    if not response.success:
        details = f"\n\n{response.details}" if response.details else ""
        raise click.ClickException(f"Deploy failed: {response.error or 'unknown error'}{details}")

    console.print(f"[green]Deployed {len(response.results)} job{'s' if len(response.results) != 1 else ''}[/green]")
    for result in response.results:
        verb = "Updated" if result.isUpdate else "Created"
        console.print(f'  {verb} "{result.jobName}" ({result.automationId})')

    console.print(f"  Files: {archive.file_count}")
    console.print(f"  Zip size: {archive.zip_size_bytes / 1024:.1f} KB")

    if response.removed:
        console.print("")
        console.print(
            f"[yellow]Removed {len(response.removed)} stale job{'s' if len(response.removed) != 1 else ''}[/yellow]"
        )
        for removed in response.removed:
            console.print(f"  {removed.name} ({removed.id})")


def _serialize_job(job: RegisteredJob) -> SdkDeployJob:
    return SdkDeployJob.model_validate(
        {
            "jobName": job.name,
            "triggers": [_serialize_trigger(trigger).model_dump(exclude_none=True) for trigger in job.triggers],
            "webhookURL": job.webhook_url,
        }
    )


def _serialize_trigger(trigger: TriggerConfig) -> SdkDeployTrigger:
    return SdkDeployTrigger.model_validate(
        {
            "configType": trigger.config_type or "",
            "integrationType": trigger.integration_type,
            "integrationId": trigger.integration_id,
            "config": dict(trigger.config),
        }
    )
