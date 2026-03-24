# ruff: noqa: E501
"""Shared generator backend for `terse generate` and `terse init`."""

from __future__ import annotations

import json
from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, TypeVar, cast
from urllib.parse import quote

from ._http import request_json
from ._project import assert_project_root, read_api_key


class MissingApiKeyError(RuntimeError):
    """Raised when `TERSE_API_KEY` is missing for a command that requires it."""


@dataclass(frozen=True)
class IntegrationInstanceData:
    id: str
    display_name: str


@dataclass(frozen=True)
class GitHubRepo:
    id: int
    name: str
    owner: str


@dataclass(frozen=True)
class GitHubInstanceData:
    id: str
    display_name: str
    repositories: list[GitHubRepo] = field(default_factory=list)


@dataclass(frozen=True)
class SlackChannelData:
    id: str
    name: str


@dataclass(frozen=True)
class SlackInstanceData:
    id: str
    display_name: str
    channels: list[SlackChannelData] = field(default_factory=list)


@dataclass(frozen=True)
class LinearTeamData:
    id: str
    name: str
    key: str


@dataclass(frozen=True)
class LinearInstanceData:
    id: str
    display_name: str
    teams: list[LinearTeamData] = field(default_factory=list)


@dataclass(frozen=True)
class JiraProjectData:
    id: str
    key: str
    name: str


@dataclass(frozen=True)
class ConfluencePageData:
    id: str
    title: str
    space_id: str
    space_name: str


@dataclass(frozen=True)
class AtlassianInstanceData:
    id: str
    display_name: str
    jira_projects: list[JiraProjectData] = field(default_factory=list)
    confluence_pages: list[ConfluencePageData] = field(default_factory=list)


@dataclass(frozen=True)
class NotionResourceData:
    id: str
    title: str


@dataclass(frozen=True)
class NotionInstanceData:
    id: str
    display_name: str
    databases: list[NotionResourceData] = field(default_factory=list)
    pages: list[NotionResourceData] = field(default_factory=list)


@dataclass(frozen=True)
class PosthogProjectData:
    id: str
    name: str


@dataclass(frozen=True)
class PosthogInstanceData:
    id: str
    display_name: str
    projects: list[PosthogProjectData] = field(default_factory=list)


@dataclass(frozen=True)
class DatadogIndexData:
    name: str


@dataclass(frozen=True)
class DatadogInstanceData:
    id: str
    display_name: str
    indexes: list[DatadogIndexData] = field(default_factory=list)


@dataclass(frozen=True)
class LaunchDarklyProjectData:
    key: str
    name: str


@dataclass(frozen=True)
class LaunchDarklyInstanceData:
    id: str
    display_name: str
    projects: list[LaunchDarklyProjectData] = field(default_factory=list)


@dataclass(frozen=True)
class AttioObjectData:
    api_slug: str
    singular_noun: str


@dataclass(frozen=True)
class AttioInstanceData:
    id: str
    display_name: str
    objects: list[AttioObjectData] = field(default_factory=list)


@dataclass(frozen=True)
class CodegenInput:
    github: list[GitHubInstanceData] = field(default_factory=list)
    gmail: list[IntegrationInstanceData] = field(default_factory=list)
    slack: list[SlackInstanceData] = field(default_factory=list)
    figma: list[IntegrationInstanceData] = field(default_factory=list)
    linear: list[LinearInstanceData] = field(default_factory=list)
    atlassian: list[AtlassianInstanceData] = field(default_factory=list)
    notion: list[NotionInstanceData] = field(default_factory=list)
    posthog: list[PosthogInstanceData] = field(default_factory=list)
    datadog: list[DatadogInstanceData] = field(default_factory=list)
    launchdarkly: list[LaunchDarklyInstanceData] = field(default_factory=list)
    workos: list[IntegrationInstanceData] = field(default_factory=list)
    attio: list[AttioInstanceData] = field(default_factory=list)


@dataclass(frozen=True)
class GenerateResult:
    project_dir: Path
    output_path: Path
    summary_lines: list[str]


T = TypeVar("T")


def generate_project(project_dir: Path | None = None) -> GenerateResult:
    """Generate Python helper bindings for the project's active integrations."""

    resolved_dir = assert_project_root(project_dir)
    api_key = read_api_key(resolved_dir)
    if not api_key:
        raise MissingApiKeyError(
            "Missing TERSE_API_KEY in .env.\nCreate a project with `terse init` or add TERSE_API_KEY to your .env file."
        )

    active_types = request_json("/integrations/active", api_key)
    active_set = {str(item) for item in active_types} if isinstance(active_types, list) else set()

    codegen_input = _build_codegen_input(active_set, api_key)
    output_path = write_generated_module(resolved_dir, render_generated_module(codegen_input))

    return GenerateResult(
        project_dir=resolved_dir,
        output_path=output_path,
        summary_lines=_build_summary_lines(codegen_input),
    )


def render_generated_module(codegen_input: CodegenInput | None = None) -> str:
    """Render the generated Python helper module."""

    input_data = codegen_input or CodegenInput()
    lines: list[str] = [
        '"""Generated by `terse generate`. Do not edit manually."""',
        "",
        "from __future__ import annotations",
        "",
        "from dataclasses import dataclass",
        "from types import SimpleNamespace",
        "",
        "from terse_sdk import SkillConfig, TriggerConfig",
        "",
        "",
        "def _compact_dict(**values: object) -> dict[str, object]:",
        '    """Drop None values while preserving falsey config values like False and []."""',
        "",
        "    return {key: value for key, value in values.items() if value is not None}",
    ]

    exported_names = ["Schedule", "Terse"]
    sections: list[list[str]] = []

    github_section = _generate_github_section(input_data.github)
    if github_section:
        sections.append(github_section)
        exported_names.extend(["GitHubRepoResource", "Repos", "GitHub"])

    gmail_section = _generate_gmail_section(input_data.gmail)
    if gmail_section:
        sections.append(gmail_section)
        exported_names.append("Gmail")

    slack_section = _generate_slack_section(input_data.slack)
    if slack_section:
        sections.append(slack_section)
        exported_names.extend(["SlackChannelResource", "SlackChannel", "Slack"])

    figma_section = _generate_figma_section(input_data.figma)
    if figma_section:
        sections.append(figma_section)
        exported_names.append("Figma")

    linear_section = _generate_linear_section(input_data.linear)
    if linear_section:
        sections.append(linear_section)
        exported_names.extend(["LinearTeamResource", "LinearTeam", "Linear"])

    atlassian_section = _generate_atlassian_section(input_data.atlassian)
    if atlassian_section:
        sections.append(atlassian_section)
        exported_names.extend(
            [
                "JiraProjectResource",
                "JiraProject",
                "ConfluencePageResource",
                "ConfluencePage",
                "Jira",
                "Confluence",
            ]
        )

    notion_section = _generate_notion_section(input_data.notion)
    if notion_section:
        sections.append(notion_section)
        exported_names.extend(
            ["NotionDatabaseResource", "NotionDatabase", "NotionPageResource", "NotionPage", "Notion"]
        )

    posthog_section = _generate_posthog_section(input_data.posthog)
    if posthog_section:
        sections.append(posthog_section)
        exported_names.extend(["PosthogProjectResource", "PosthogProject", "Posthog"])

    datadog_section = _generate_datadog_section(input_data.datadog)
    if datadog_section:
        sections.append(datadog_section)
        exported_names.extend(["DatadogIndexResource", "DatadogIndex", "Datadog"])

    launchdarkly_section = _generate_launchdarkly_section(input_data.launchdarkly)
    if launchdarkly_section:
        sections.append(launchdarkly_section)
        exported_names.extend(["LaunchDarklyProjectResource", "LaunchDarklyProject", "LaunchDarkly"])

    workos_section = _generate_workos_section(input_data.workos)
    if workos_section:
        sections.append(workos_section)
        exported_names.append("WorkOS")

    attio_section = _generate_attio_section(input_data.attio)
    if attio_section:
        sections.append(attio_section)
        exported_names.extend(["AttioObjectResource", "AttioObject", "Attio"])

    sections.append(_generate_system_section())

    for section in sections:
        lines.extend(["", "", *section])

    lines.extend(["", "", f"__all__ = {json.dumps(exported_names)}", ""])
    return "\n".join(lines)


def write_generated_module(project_dir: Path, content: str) -> Path:
    """Write the generated helper module into the project's src directory."""

    output_path = project_dir / "src" / "terse_generated.py"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(content, encoding="utf-8")
    return output_path


def _build_codegen_input(active_set: set[str], api_key: str) -> CodegenInput:
    return CodegenInput(
        github=_safe_fetch(lambda: _fetch_github_instances(api_key)) if "github" in active_set else [],
        gmail=_safe_fetch(lambda: _fetch_gmail_instances(api_key)) if "gmail" in active_set else [],
        slack=_safe_fetch(lambda: _fetch_slack_instances(api_key)) if "slack" in active_set else [],
        figma=_safe_fetch(lambda: _fetch_figma_instances(api_key)) if "figma" in active_set else [],
        linear=_safe_fetch(lambda: _fetch_linear_instances(api_key)) if "linear" in active_set else [],
        atlassian=_safe_fetch(lambda: _fetch_atlassian_instances(api_key)) if "atlassian" in active_set else [],
        notion=_safe_fetch(lambda: _fetch_notion_instances(api_key)) if "notion" in active_set else [],
        posthog=_safe_fetch(lambda: _fetch_posthog_instances(api_key)) if "posthog" in active_set else [],
        datadog=_safe_fetch(lambda: _fetch_datadog_instances(api_key)) if "datadog" in active_set else [],
        launchdarkly=_safe_fetch(lambda: _fetch_launchdarkly_instances(api_key))
        if "launchdarkly" in active_set
        else [],
        workos=_safe_fetch(lambda: _fetch_workos_instances(api_key)) if "workos" in active_set else [],
        attio=_safe_fetch(lambda: _fetch_attio_instances(api_key)) if "attio" in active_set else [],
    )


def _safe_fetch(fetcher: Callable[[], list[T]]) -> list[T]:
    try:
        return fetcher()
    except Exception:
        return []


def _as_dict(value: object) -> dict[str, Any] | None:
    if isinstance(value, dict):
        return cast(dict[str, Any], value)
    return None


def _as_list(value: object) -> list[Any]:
    if isinstance(value, list):
        return cast(list[Any], value)
    return []


def _fetch_github_instances(api_key: str) -> list[GitHubInstanceData]:
    raw_instances = _as_list(request_json("/github/integrations", api_key))

    instances: list[GitHubInstanceData] = []
    for integration in raw_instances:
        integration_data = _as_dict(integration)
        if integration_data is None:
            continue

        response = _safe_request_json(
            "/github/get-repositories-for-integration",
            api_key,
            params={"installation_id": integration_data.get("installation_id")},
        )
        response_data = _as_dict(response) or {}
        repositories_payload = _as_list(response_data.get("repositories", []))
        repositories = [
            GitHubRepo(
                id=int((_as_dict(repository) or {}).get("id", 0)),
                name=str((_as_dict(repository) or {}).get("name", "")),
                owner=str((_as_dict(repository) or {}).get("owner", "")),
            )
            for repository in repositories_payload
            if _as_dict(repository) is not None and (_as_dict(repository) or {}).get("id") is not None
        ]
        instances.append(
            GitHubInstanceData(
                id=str(integration_data.get("id", "")),
                display_name=str(integration_data.get("account_name") or integration_data.get("id") or ""),
                repositories=repositories,
            )
        )
    return instances


def _fetch_gmail_instances(api_key: str) -> list[IntegrationInstanceData]:
    return _fetch_simple_instances(api_key, "/gmail/integrations", "email")


def _fetch_figma_instances(api_key: str) -> list[IntegrationInstanceData]:
    return _fetch_simple_instances(api_key, "/figma/integrations", "handle")


def _fetch_workos_instances(api_key: str) -> list[IntegrationInstanceData]:
    return _fetch_simple_instances(api_key, "/workos-integration/integrations", "environment")


def _fetch_slack_instances(api_key: str) -> list[SlackInstanceData]:
    raw_instances = _as_list(request_json("/slack/integrations", api_key))

    instances: list[SlackInstanceData] = []
    for integration in raw_instances:
        integration_data = _as_dict(integration)
        if integration_data is None:
            continue

        response = _safe_request_json("/slack/channels", api_key, params={"integrationId": integration_data.get("id")})
        response_data = _as_dict(response) or {}
        channels_payload = _as_list(response_data.get("channels", []))
        channels = [
            SlackChannelData(
                id=str((_as_dict(channel) or {}).get("id", "")),
                name=str((_as_dict(channel) or {}).get("name", "")),
            )
            for channel in channels_payload
            if _as_dict(channel) is not None
        ]
        instances.append(
            SlackInstanceData(
                id=str(integration_data.get("id", "")),
                display_name=str(integration_data.get("teamName") or integration_data.get("id") or ""),
                channels=channels,
            )
        )
    return instances


def _fetch_linear_instances(api_key: str) -> list[LinearInstanceData]:
    raw_instances = _as_list(request_json("/linear/integrations", api_key))

    instances: list[LinearInstanceData] = []
    for integration in raw_instances:
        integration_data = _as_dict(integration)
        if integration_data is None:
            continue

        response = _safe_request_json("/linear/teams", api_key, params={"integrationId": integration_data.get("id")})
        teams_payload = _as_list(response)
        teams = [
            LinearTeamData(
                id=str((_as_dict(team) or {}).get("id", "")),
                name=str((_as_dict(team) or {}).get("name", "")),
                key=str((_as_dict(team) or {}).get("key", "")),
            )
            for team in teams_payload
            if _as_dict(team) is not None
        ]
        instances.append(
            LinearInstanceData(
                id=str(integration_data.get("id", "")),
                display_name=str(integration_data.get("workspaceName") or integration_data.get("id") or ""),
                teams=teams,
            )
        )
    return instances


def _fetch_atlassian_instances(api_key: str) -> list[AtlassianInstanceData]:
    raw_instances = _as_list(request_json("/atlassian/integrations", api_key))

    instances: list[AtlassianInstanceData] = []
    for integration in raw_instances:
        integration_data = _as_dict(integration)
        if integration_data is None:
            continue

        integration_id = integration_data.get("id")
        jira_response = _safe_request_json("/jira/resources", api_key, params={"integrationId": integration_id})
        jira_data = _as_dict(jira_response) or {}
        jira_resources = _as_dict(jira_data.get("resources", {})) or {}
        jira_payload = _as_list(jira_resources.get("projects", []))
        jira_projects = [
            JiraProjectData(
                id=str((_as_dict(project) or {}).get("id", "")),
                key=str((_as_dict(project) or {}).get("key", "")),
                name=str((_as_dict(project) or {}).get("name", "")),
            )
            for project in jira_payload
            if _as_dict(project) is not None
        ]

        confluence_response = _safe_request_json(
            "/confluence/resources",
            api_key,
            params={"integrationId": integration_id},
        )
        confluence_data = _as_dict(confluence_response) or {}
        confluence_payload = _as_list(confluence_data.get("resources", []))
        confluence_pages = [
            ConfluencePageData(
                id=str((_as_dict(page) or {}).get("id", "")),
                title=str((_as_dict(page) or {}).get("title", "")),
                space_id=str((_as_dict(page) or {}).get("spaceId", "")),
                space_name=str((_as_dict(page) or {}).get("spaceName", "")),
            )
            for page in confluence_payload
            if _as_dict(page) is not None
        ]

        instances.append(
            AtlassianInstanceData(
                id=str(integration_id or ""),
                display_name=str(
                    integration_data.get("siteName") or integration_data.get("email") or integration_id or ""
                ),
                jira_projects=jira_projects,
                confluence_pages=confluence_pages,
            )
        )
    return instances


def _fetch_notion_instances(api_key: str) -> list[NotionInstanceData]:
    raw_instances = _as_list(request_json("/notion/integrations", api_key))

    instances: list[NotionInstanceData] = []
    for integration in raw_instances:
        integration_data = _as_dict(integration)
        if integration_data is None:
            continue

        response = _safe_request_json(
            "/notion/resources", api_key, params={"integrationId": integration_data.get("id")}
        )
        response_data = _as_dict(response) or {}
        payload = _as_list(response_data.get("resources", []))
        databases: list[NotionResourceData] = []
        pages: list[NotionResourceData] = []

        for resource in payload:
            resource_data = _as_dict(resource)
            if resource_data is None:
                continue
            item = NotionResourceData(id=str(resource_data.get("id", "")), title=str(resource_data.get("title", "")))
            resource_type = str(resource_data.get("type", ""))
            if resource_type == "database":
                databases.append(item)
            elif resource_type == "page":
                pages.append(item)

        instances.append(
            NotionInstanceData(
                id=str(integration_data.get("id", "")),
                display_name=str(integration_data.get("workspaceName") or integration_data.get("id") or ""),
                databases=databases,
                pages=pages,
            )
        )
    return instances


def _fetch_posthog_instances(api_key: str) -> list[PosthogInstanceData]:
    raw_instances = _as_list(request_json("/posthog/integrations", api_key))

    instances: list[PosthogInstanceData] = []
    for integration in raw_instances:
        integration_data = _as_dict(integration)
        if integration_data is None:
            continue

        response = _safe_request_json(
            "/posthog/projects", api_key, params={"integrationId": integration_data.get("id")}
        )
        response_data = _as_dict(response) or {}
        payload = _as_list(response_data.get("projects", []))
        projects = [
            PosthogProjectData(
                id=str((_as_dict(project) or {}).get("id", "")),
                name=str((_as_dict(project) or {}).get("name", "")),
            )
            for project in payload
            if _as_dict(project) is not None
        ]
        instances.append(
            PosthogInstanceData(
                id=str(integration_data.get("id", "")),
                display_name=str(
                    integration_data.get("orgName") or integration_data.get("email") or integration_data.get("id") or ""
                ),
                projects=projects,
            )
        )
    return instances


def _fetch_datadog_instances(api_key: str) -> list[DatadogInstanceData]:
    raw_instances = _as_list(request_json("/datadog/integrations", api_key))

    instances: list[DatadogInstanceData] = []
    for integration in raw_instances:
        integration_data = _as_dict(integration)
        if integration_data is None:
            continue

        response = _safe_request_json("/datadog/indexes", api_key, params={"integrationId": integration_data.get("id")})
        response_data = _as_dict(response) or {}
        payload = _as_list(response_data.get("indexes", []))
        indexes = [
            DatadogIndexData(name=str((_as_dict(index) or {}).get("name", "")))
            for index in payload
            if _as_dict(index) is not None
        ]
        instances.append(
            DatadogInstanceData(
                id=str(integration_data.get("id", "")),
                display_name=str(integration_data.get("region") or integration_data.get("id") or ""),
                indexes=indexes,
            )
        )
    return instances


def _fetch_launchdarkly_instances(api_key: str) -> list[LaunchDarklyInstanceData]:
    raw_instances = _as_list(request_json("/launchdarkly/integrations", api_key))

    instances: list[LaunchDarklyInstanceData] = []
    for integration in raw_instances:
        integration_data = _as_dict(integration)
        if integration_data is None:
            continue

        integration_id = str(integration_data.get("id", ""))
        response = _safe_request_json(
            f"/launchdarkly/integrations/{quote(integration_id, safe='')}/projects",
            api_key,
        )
        response_data = _as_dict(response) or {}
        payload = _as_list(response_data.get("projects", []))
        projects = [
            LaunchDarklyProjectData(
                key=str((_as_dict(project) or {}).get("key", "")),
                name=str((_as_dict(project) or {}).get("name", "")),
            )
            for project in payload
            if _as_dict(project) is not None
        ]
        instances.append(
            LaunchDarklyInstanceData(
                id=integration_id,
                display_name=str(integration_data.get("tokenName") or integration_data.get("email") or integration_id),
                projects=projects,
            )
        )
    return instances


def _fetch_attio_instances(api_key: str) -> list[AttioInstanceData]:
    raw_instances = _as_list(request_json("/attio/integrations", api_key))

    instances: list[AttioInstanceData] = []
    for integration in raw_instances:
        integration_data = _as_dict(integration)
        if integration_data is None:
            continue

        integration_id = str(integration_data.get("id", ""))
        response = _safe_request_json(f"/attio/integrations/{quote(integration_id, safe='')}/objects", api_key)
        payload = _as_list(response)
        objects = [
            AttioObjectData(
                api_slug=str((_as_dict(obj) or {}).get("api_slug", "")),
                singular_noun=str((_as_dict(obj) or {}).get("singular_noun", "")),
            )
            for obj in payload
            if _as_dict(obj) is not None
        ]
        instances.append(
            AttioInstanceData(
                id=integration_id,
                display_name=str(integration_data.get("workspaceName") or integration_id),
                objects=objects,
            )
        )
    return instances


def _fetch_simple_instances(api_key: str, path: str, display_field: str) -> list[IntegrationInstanceData]:
    payload = _as_list(request_json(path, api_key))

    return [
        IntegrationInstanceData(
            id=str((_as_dict(integration) or {}).get("id", "")),
            display_name=str(
                (_as_dict(integration) or {}).get(display_field) or (_as_dict(integration) or {}).get("id") or ""
            ),
        )
        for integration in payload
        if _as_dict(integration) is not None
    ]


def _safe_request_json(path: str, api_key: str, *, params: dict[str, object] | None = None) -> object | None:
    try:
        return request_json(path, api_key, params=params)
    except Exception:
        return None


def _build_summary_lines(codegen_input: CodegenInput) -> list[str]:
    lines: list[str] = []
    for instance in codegen_input.github:
        lines.append(f"GitHub ({instance.display_name}) — {len(instance.repositories)} repositories")
    for instance in codegen_input.gmail:
        lines.append(f"Gmail ({instance.display_name})")
    for instance in codegen_input.slack:
        lines.append(f"Slack ({instance.display_name}) — {len(instance.channels)} channels")
    for instance in codegen_input.figma:
        lines.append(f"Figma ({instance.display_name})")
    for instance in codegen_input.linear:
        lines.append(f"Linear ({instance.display_name}) — {len(instance.teams)} teams")
    for instance in codegen_input.atlassian:
        lines.append(f"Jira ({instance.display_name}) — {len(instance.jira_projects)} projects")
        lines.append(f"Confluence ({instance.display_name}) — {len(instance.confluence_pages)} pages")
    for instance in codegen_input.notion:
        lines.append(
            f"Notion ({instance.display_name}) — {len(instance.databases)} databases, {len(instance.pages)} pages"
        )
    for instance in codegen_input.posthog:
        lines.append(f"PostHog ({instance.display_name}) — {len(instance.projects)} projects")
    for instance in codegen_input.datadog:
        lines.append(f"Datadog ({instance.display_name}) — {len(instance.indexes)} indexes")
    for instance in codegen_input.launchdarkly:
        lines.append(f"LaunchDarkly ({instance.display_name}) — {len(instance.projects)} projects")
    for instance in codegen_input.workos:
        lines.append(f"WorkOS ({instance.display_name})")
    for instance in codegen_input.attio:
        lines.append(f"Attio ({instance.display_name}) — {len(instance.objects)} objects")
    lines.append("Schedule trigger")
    lines.append("Terse skills (web search)")
    return lines


def _generate_github_section(instances: list[GitHubInstanceData]) -> list[str]:
    if not instances:
        return []

    instance = instances[0]
    used_owner_names: set[str] = set()
    owner_blocks: list[str] = []

    by_owner: dict[str, list[GitHubRepo]] = {}
    for repository in instance.repositories:
        by_owner.setdefault(repository.owner or "UnknownOwner", []).append(repository)

    for owner, repositories in by_owner.items():
        owner_name = _unique_name(_to_pascal_case(owner) or "UnknownOwner", used_owner_names)
        used_repo_names: set[str] = set()
        repo_lines = [f"    {owner_name}=SimpleNamespace("]
        for repository in repositories:
            repo_name = _unique_name(_to_pascal_case(repository.name) or "Repository", used_repo_names)
            repo_lines.append(
                "        "
                f"{repo_name}=GitHubRepoResource("
                f"repository_id={repository.id}, "
                f"name={_render_value(repository.name)}, "
                f"owner={_render_value(repository.owner)}, "
                f"full_name={_render_value(_full_repo_name(repository))}"
                "),"
            )
        repo_lines.append("    ),")
        owner_blocks.extend(repo_lines)

    lines = [
        "# === GitHub ===",
        "",
        "@dataclass(frozen=True)",
        "class GitHubRepoResource:",
        "    repository_id: int",
        "    name: str",
        "    owner: str",
        "    full_name: str",
        "",
        "Repos = SimpleNamespace(",
        *owner_blocks,
        ")",
        "",
        "class GitHub:",
        "    @staticmethod",
        "    def on_push(*, repo: GitHubRepoResource) -> TriggerConfig:",
        f"        return TriggerConfig(integration_id={_render_value(instance.id)}, integration_type='github', config_type='github', config=_compact_dict(repositoryIds=[repo.repository_id], eventTypes=['push']))",
        "",
        "    @staticmethod",
        "    def on_pr_opened(*, repo: GitHubRepoResource) -> TriggerConfig:",
        f"        return TriggerConfig(integration_id={_render_value(instance.id)}, integration_type='github', config_type='github', config=_compact_dict(repositoryIds=[repo.repository_id], eventTypes=['pull_request.opened']))",
        "",
        "    @staticmethod",
        "    def on_pr_merged(*, repo: GitHubRepoResource) -> TriggerConfig:",
        f"        return TriggerConfig(integration_id={_render_value(instance.id)}, integration_type='github', config_type='github', config=_compact_dict(repositoryIds=[repo.repository_id], eventTypes=['pull_request.merged']))",
        "",
        "    @staticmethod",
        "    def on_pr_closed(*, repo: GitHubRepoResource) -> TriggerConfig:",
        f"        return TriggerConfig(integration_id={_render_value(instance.id)}, integration_type='github', config_type='github', config=_compact_dict(repositoryIds=[repo.repository_id], eventTypes=['pull_request.closed']))",
        "",
        "    @staticmethod",
        "    def on_pr(*, repo: GitHubRepoResource) -> TriggerConfig:",
        f"        return TriggerConfig(integration_id={_render_value(instance.id)}, integration_type='github', config_type='github', config=_compact_dict(repositoryIds=[repo.repository_id], eventTypes=['pull_request.opened', 'pull_request.merged', 'pull_request.closed', 'pull_request.synchronize']))",
        "",
        "    @staticmethod",
        "    def trigger(*, repos: list[GitHubRepoResource], event_types: list[str] | None = None) -> TriggerConfig:",
        f"        return TriggerConfig(integration_id={_render_value(instance.id)}, integration_type='github', config_type='github', config=_compact_dict(repositoryIds=[repo.repository_id for repo in repos], eventTypes=event_types))",
        "",
        "    @staticmethod",
        "    def skill(*, repos: list[GitHubRepoResource]) -> SkillConfig:",
        f"        return SkillConfig(integration_id={_render_value(instance.id)}, integration_type='github', config_type='github', config=_compact_dict(repositoryIds=[repo.repository_id for repo in repos]))",
    ]
    return lines


def _generate_gmail_section(instances: list[IntegrationInstanceData]) -> list[str]:
    if not instances:
        return []

    integration_id = instances[0].id
    return [
        "# === Gmail ===",
        "",
        "class Gmail:",
        "    @staticmethod",
        "    def on_email() -> TriggerConfig:",
        f"        return TriggerConfig(integration_id={_render_value(integration_id)}, integration_type='gmail', config_type='gmail', config=_compact_dict(eventTypes=['email.received']))",
        "",
        "    @staticmethod",
        "    def trigger(*, event_types: list[str] | None = None) -> TriggerConfig:",
        f"        return TriggerConfig(integration_id={_render_value(integration_id)}, integration_type='gmail', config_type='gmail', config=_compact_dict(eventTypes=event_types))",
        "",
        "    @staticmethod",
        "    def skill() -> SkillConfig:",
        f"        return SkillConfig(integration_id={_render_value(integration_id)}, integration_type='gmail', config_type='gmail_output', config={{}})",
        "",
        "    @staticmethod",
        "    def draft_skill() -> SkillConfig:",
        f"        return SkillConfig(integration_id={_render_value(integration_id)}, integration_type='gmail', config_type='gmail_draft_output', config={{}})",
    ]


def _generate_slack_section(instances: list[SlackInstanceData]) -> list[str]:
    if not instances:
        return []

    instance = instances[0]
    namespace_lines = _generate_resource_namespace(
        "SlackChannelResource",
        "SlackChannel",
        [("channel_id", "str"), ("name", "str")],
        instance.channels,
        [("channel_id", "id"), ("name", "name")],
        "name",
    )

    return [
        "# === Slack ===",
        "",
        *namespace_lines,
        "",
        "class Slack:",
        "    @staticmethod",
        "    def on_message(*, channel: SlackChannelResource, user_ids: list[str] | None = None) -> TriggerConfig:",
        f"        return TriggerConfig(integration_id={_render_value(instance.id)}, integration_type='slack', config_type='slack', config=_compact_dict(channelId=channel.channel_id, channelName=channel.name, listenToUserDms=False, userIds=user_ids, eventTypes=['message']))",
        "",
        "    @staticmethod",
        "    def on_dm(*, user_ids: list[str] | None = None) -> TriggerConfig:",
        f"        return TriggerConfig(integration_id={_render_value(instance.id)}, integration_type='slack', config_type='slack', config=_compact_dict(listenToUserDms=True, userIds=user_ids, eventTypes=['message']))",
        "",
        "    @staticmethod",
        "    def trigger(*, channel: SlackChannelResource | None = None, listen_to_user_dms: bool = False, user_ids: list[str] | None = None, event_types: list[str] | None = None) -> TriggerConfig:",
        f"        return TriggerConfig(integration_id={_render_value(instance.id)}, integration_type='slack', config_type='slack', config=_compact_dict(channelId=channel.channel_id if channel else None, channelName=channel.name if channel else None, listenToUserDms=listen_to_user_dms, userIds=user_ids, eventTypes=event_types))",
        "",
        "    @staticmethod",
        "    def skill(*, channel: SlackChannelResource | None = None, user_ids: list[str] | None = None, user_names: list[str] | None = None, listen_to_user_dms: bool = False) -> SkillConfig:",
        f"        return SkillConfig(integration_id={_render_value(instance.id)}, integration_type='slack', config_type='slack_output', config=_compact_dict(channelId=channel.channel_id if channel else None, channelName=channel.name if channel else None, userIds=user_ids, userNames=user_names, listenToUserDms=listen_to_user_dms))",
    ]


def _generate_figma_section(instances: list[IntegrationInstanceData]) -> list[str]:
    if not instances:
        return []

    integration_id = instances[0].id
    return [
        "# === Figma ===",
        "",
        "class Figma:",
        "    @staticmethod",
        "    def on_comment(*, file_key: str, file_name: str, team_id: str) -> TriggerConfig:",
        f"        return TriggerConfig(integration_id={_render_value(integration_id)}, integration_type='figma', config_type='figma', config=_compact_dict(fileKey=file_key, fileName=file_name, teamId=team_id, eventTypes=['file_comment']))",
        "",
        "    @staticmethod",
        "    def trigger(*, file_key: str, file_name: str, team_id: str, event_types: list[str] | None = None) -> TriggerConfig:",
        f"        return TriggerConfig(integration_id={_render_value(integration_id)}, integration_type='figma', config_type='figma', config=_compact_dict(fileKey=file_key, fileName=file_name, teamId=team_id, eventTypes=event_types))",
    ]


def _generate_linear_section(instances: list[LinearInstanceData]) -> list[str]:
    if not instances:
        return []

    instance = instances[0]
    namespace_lines = _generate_resource_namespace(
        "LinearTeamResource",
        "LinearTeam",
        [("team_id", "str"), ("name", "str"), ("key", "str")],
        instance.teams,
        [("team_id", "id"), ("name", "name"), ("key", "key")],
        "name",
    )

    return [
        "# === Linear ===",
        "",
        *namespace_lines,
        "",
        "class Linear:",
        "    @staticmethod",
        "    def on_issue_created(*, project_id: str | None = None, project_name: str | None = None) -> TriggerConfig:",
        f"        return TriggerConfig(integration_id={_render_value(instance.id)}, integration_type='linear', config_type='linear_input', config=_compact_dict(projectId=project_id, projectName=project_name, eventTypes=['issue.created']))",
        "",
        "    @staticmethod",
        "    def on_issue_updated(*, project_id: str | None = None, project_name: str | None = None) -> TriggerConfig:",
        f"        return TriggerConfig(integration_id={_render_value(instance.id)}, integration_type='linear', config_type='linear_input', config=_compact_dict(projectId=project_id, projectName=project_name, eventTypes=['issue.updated']))",
        "",
        "    @staticmethod",
        "    def on_comment(*, project_id: str | None = None, project_name: str | None = None) -> TriggerConfig:",
        f"        return TriggerConfig(integration_id={_render_value(instance.id)}, integration_type='linear', config_type='linear_input', config=_compact_dict(projectId=project_id, projectName=project_name, eventTypes=['comment.created']))",
        "",
        "    @staticmethod",
        "    def trigger(*, project_id: str | None = None, project_name: str | None = None, event_types: list[str] | None = None) -> TriggerConfig:",
        f"        return TriggerConfig(integration_id={_render_value(instance.id)}, integration_type='linear', config_type='linear_input', config=_compact_dict(projectId=project_id, projectName=project_name, eventTypes=event_types))",
        "",
        "    @staticmethod",
        "    def skill(*, team: LinearTeamResource | None = None, project_id: str | None = None, project_name: str | None = None) -> SkillConfig:",
        f"        return SkillConfig(integration_id={_render_value(instance.id)}, integration_type='linear', config_type='linear_output', config=_compact_dict(teamId=team.team_id if team else None, teamName=team.name if team else None, projectId=project_id, projectName=project_name))",
    ]


def _generate_atlassian_section(instances: list[AtlassianInstanceData]) -> list[str]:
    if not instances:
        return []

    instance = instances[0]
    jira_namespace_lines = _generate_resource_namespace(
        "JiraProjectResource",
        "JiraProject",
        [("project_key", "str"), ("project_id", "str"), ("name", "str")],
        instance.jira_projects,
        [("project_key", "key"), ("project_id", "id"), ("name", "name")],
        "name",
    )
    confluence_namespace_lines = _generate_resource_namespace(
        "ConfluencePageResource",
        "ConfluencePage",
        [("page_id", "str"), ("title", "str"), ("space_id", "str"), ("space_name", "str")],
        instance.confluence_pages,
        [("page_id", "id"), ("title", "title"), ("space_id", "space_id"), ("space_name", "space_name")],
        "title",
    )

    return [
        "# === Jira & Confluence ===",
        "",
        *jira_namespace_lines,
        "",
        *confluence_namespace_lines,
        "",
        "class Jira:",
        "    @staticmethod",
        "    def on_issue_created(*, project: JiraProjectResource | None = None) -> TriggerConfig:",
        f"        return TriggerConfig(integration_id={_render_value(instance.id)}, integration_type='atlassian', config_type='jira', config=_compact_dict(projectKey=project.project_key if project else None, projectId=project.project_id if project else None, eventTypes=['issue.created']))",
        "",
        "    @staticmethod",
        "    def on_issue_updated(*, project: JiraProjectResource | None = None) -> TriggerConfig:",
        f"        return TriggerConfig(integration_id={_render_value(instance.id)}, integration_type='atlassian', config_type='jira', config=_compact_dict(projectKey=project.project_key if project else None, projectId=project.project_id if project else None, eventTypes=['issue.updated']))",
        "",
        "    @staticmethod",
        "    def trigger(*, project: JiraProjectResource | None = None, event_types: list[str] | None = None) -> TriggerConfig:",
        f"        return TriggerConfig(integration_id={_render_value(instance.id)}, integration_type='atlassian', config_type='jira', config=_compact_dict(projectKey=project.project_key if project else None, projectId=project.project_id if project else None, eventTypes=event_types))",
        "",
        "    @staticmethod",
        "    def skill(*, project: JiraProjectResource | None = None) -> SkillConfig:",
        f"        return SkillConfig(integration_id={_render_value(instance.id)}, integration_type='atlassian', config_type='jira', config=_compact_dict(projectKey=project.project_key if project else None, projectId=project.project_id if project else None))",
        "",
        "class Confluence:",
        "    @staticmethod",
        "    def skill(*, page: ConfluencePageResource) -> SkillConfig:",
        f"        return SkillConfig(integration_id={_render_value(instance.id)}, integration_type='atlassian', config_type='confluence', config=_compact_dict(spaceName=page.space_name, spaceId=page.space_id, pageId=page.page_id, pageName=page.title))",
    ]


def _generate_notion_section(instances: list[NotionInstanceData]) -> list[str]:
    if not instances:
        return []

    instance = instances[0]
    database_lines = _generate_resource_namespace(
        "NotionDatabaseResource",
        "NotionDatabase",
        [("database_id", "str"), ("title", "str")],
        instance.databases,
        [("database_id", "id"), ("title", "title")],
        "title",
    )
    page_lines = _generate_resource_namespace(
        "NotionPageResource",
        "NotionPage",
        [("page_id", "str"), ("title", "str")],
        instance.pages,
        [("page_id", "id"), ("title", "title")],
        "title",
    )

    return [
        "# === Notion ===",
        "",
        *database_lines,
        "",
        *page_lines,
        "",
        "class Notion:",
        "    @staticmethod",
        "    def skill(*, databases: list[NotionDatabaseResource] | None = None, pages: list[NotionPageResource] | None = None) -> SkillConfig:",
        f"        return SkillConfig(integration_id={_render_value(instance.id)}, integration_type='notion', config_type='notion', config=_compact_dict(databaseIds=[database.database_id for database in databases] if databases is not None else None, databaseNames=[database.title for database in databases] if databases is not None else None, pageIds=[page.page_id for page in pages] if pages is not None else None, pageNames=[page.title for page in pages] if pages is not None else None))",
    ]


def _generate_posthog_section(instances: list[PosthogInstanceData]) -> list[str]:
    if not instances:
        return []

    instance = instances[0]
    namespace_lines = _generate_resource_namespace(
        "PosthogProjectResource",
        "PosthogProject",
        [("project_id", "str"), ("name", "str")],
        instance.projects,
        [("project_id", "id"), ("name", "name")],
        "name",
    )

    return [
        "# === PostHog ===",
        "",
        *namespace_lines,
        "",
        "class Posthog:",
        "    @staticmethod",
        "    def skill(*, project: PosthogProjectResource) -> SkillConfig:",
        f"        return SkillConfig(integration_id={_render_value(instance.id)}, integration_type='posthog', config_type='POSTHOG', config=_compact_dict(projectId=project.project_id, projectName=project.name))",
    ]


def _generate_datadog_section(instances: list[DatadogInstanceData]) -> list[str]:
    if not instances:
        return []

    instance = instances[0]
    namespace_lines = _generate_resource_namespace(
        "DatadogIndexResource",
        "DatadogIndex",
        [("name", "str")],
        instance.indexes,
        [("name", "name")],
        "name",
    )

    return [
        "# === Datadog ===",
        "",
        *namespace_lines,
        "",
        "class Datadog:",
        "    @staticmethod",
        "    def skill(*, indexes: list[DatadogIndexResource] | None = None) -> SkillConfig:",
        f"        return SkillConfig(integration_id={_render_value(instance.id)}, integration_type='datadog', config_type='DATADOG', config=_compact_dict(defaultIndexes=[index.name for index in indexes] if indexes is not None else ['main']))",
    ]


def _generate_launchdarkly_section(instances: list[LaunchDarklyInstanceData]) -> list[str]:
    if not instances:
        return []

    instance = instances[0]
    namespace_lines = _generate_resource_namespace(
        "LaunchDarklyProjectResource",
        "LaunchDarklyProject",
        [("project_key", "str"), ("name", "str")],
        instance.projects,
        [("project_key", "key"), ("name", "name")],
        "name",
    )

    return [
        "# === LaunchDarkly ===",
        "",
        *namespace_lines,
        "",
        "class LaunchDarkly:",
        "    @staticmethod",
        "    def skill(*, project: LaunchDarklyProjectResource, environment_keys: list[str]) -> SkillConfig:",
        f"        return SkillConfig(integration_id={_render_value(instance.id)}, integration_type='launchdarkly', config_type='launchdarkly', config=_compact_dict(projectKey=project.project_key, environmentKeys=environment_keys))",
    ]


def _generate_workos_section(instances: list[IntegrationInstanceData]) -> list[str]:
    if not instances:
        return []

    integration_id = instances[0].id
    return [
        "# === WorkOS ===",
        "",
        "class WorkOS:",
        "    @staticmethod",
        "    def on_user_created() -> TriggerConfig:",
        f"        return TriggerConfig(integration_id={_render_value(integration_id)}, integration_type='workos', config_type='workos_input', config=_compact_dict(eventTypes=['user.created']))",
        "",
        "    @staticmethod",
        "    def on_user_updated() -> TriggerConfig:",
        f"        return TriggerConfig(integration_id={_render_value(integration_id)}, integration_type='workos', config_type='workos_input', config=_compact_dict(eventTypes=['user.updated']))",
        "",
        "    @staticmethod",
        "    def on_user_deleted() -> TriggerConfig:",
        f"        return TriggerConfig(integration_id={_render_value(integration_id)}, integration_type='workos', config_type='workos_input', config=_compact_dict(eventTypes=['user.deleted']))",
        "",
        "    @staticmethod",
        "    def on_membership_changed() -> TriggerConfig:",
        f"        return TriggerConfig(integration_id={_render_value(integration_id)}, integration_type='workos', config_type='workos_input', config=_compact_dict(eventTypes=['organization_membership.created', 'organization_membership.updated', 'organization_membership.deleted']))",
        "",
        "    @staticmethod",
        "    def on_invitation_accepted() -> TriggerConfig:",
        f"        return TriggerConfig(integration_id={_render_value(integration_id)}, integration_type='workos', config_type='workos_input', config=_compact_dict(eventTypes=['invitation.accepted']))",
        "",
        "    @staticmethod",
        "    def trigger(*, event_types: list[str] | None = None) -> TriggerConfig:",
        f"        return TriggerConfig(integration_id={_render_value(integration_id)}, integration_type='workos', config_type='workos_input', config=_compact_dict(eventTypes=event_types if event_types is not None else []))",
        "",
        "    @staticmethod",
        "    def skill() -> SkillConfig:",
        f"        return SkillConfig(integration_id={_render_value(integration_id)}, integration_type='workos', config_type='workos_output', config={{}})",
    ]


def _generate_attio_section(instances: list[AttioInstanceData]) -> list[str]:
    if not instances:
        return []

    instance = instances[0]
    namespace_lines = _generate_resource_namespace(
        "AttioObjectResource",
        "AttioObject",
        [("api_slug", "str"), ("name", "str")],
        instance.objects,
        [("api_slug", "api_slug"), ("name", "singular_noun")],
        "singular_noun",
    )

    return [
        "# === Attio ===",
        "",
        *namespace_lines,
        "",
        "class Attio:",
        "    @staticmethod",
        "    def skill(*, obj: AttioObjectResource | None = None) -> SkillConfig:",
        f"        return SkillConfig(integration_id={_render_value(instance.id)}, integration_type='attio', config_type='attio_output', config=_compact_dict(objectSlug=obj.api_slug if obj else None))",
    ]


def _generate_system_section() -> list[str]:
    return [
        "# === Schedule ===",
        "",
        "class Schedule:",
        "    @staticmethod",
        "    def cron(expression: str) -> TriggerConfig:",
        "        return TriggerConfig(integration_id='system', integration_type='cron_job', config_type='time_trigger', config=_compact_dict(cronExpression=expression))",
        "",
        "# === Terse ===",
        "",
        "class Terse:",
        "    @staticmethod",
        "    def skill() -> SkillConfig:",
        "        return SkillConfig(integration_id='system', integration_type='terse', config_type='terse', config={})",
    ]


def _generate_resource_namespace(
    type_name: str,
    namespace_name: str,
    fields: list[tuple[str, str]],
    items: list[Any],
    source_mappings: list[tuple[str, str]],
    static_name_field: str,
) -> list[str]:
    lines = [
        "@dataclass(frozen=True)",
        f"class {type_name}:",
        *[f"    {field_name}: {field_type}" for field_name, field_type in fields],
        "",
    ]

    if not items:
        lines.append(f"{namespace_name} = SimpleNamespace()")
        return lines

    used_names: set[str] = set()
    lines.append(f"{namespace_name} = SimpleNamespace(")
    for item in items:
        raw_name = getattr(item, static_name_field, "")
        static_name = _unique_name(_to_pascal_case(str(raw_name)) or namespace_name, used_names)
        args = ", ".join(
            f"{target_name}={_render_value(getattr(item, source_name))}" for target_name, source_name in source_mappings
        )
        lines.append(f"    {static_name}={type_name}({args}),")
    lines.append(")")
    return lines


def _render_value(value: object) -> str:
    return repr(value)


def _to_pascal_case(value: str) -> str:
    words = "".join(character if character.isalnum() else " " for character in value).split()
    pascal = "".join(word[:1].upper() + word[1:] for word in words)
    if pascal and pascal[0].isdigit():
        return f"_{pascal}"
    return pascal


def _unique_name(name: str, used_names: set[str]) -> str:
    candidate = name
    while candidate in used_names:
        candidate = f"{candidate}_"
    used_names.add(candidate)
    return candidate


def _full_repo_name(repository: GitHubRepo) -> str:
    if repository.owner and repository.name:
        return f"{repository.owner}/{repository.name}"
    return repository.name
