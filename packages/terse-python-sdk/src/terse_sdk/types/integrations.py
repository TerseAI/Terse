"""Integration and config models."""

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import Discriminator, Field, Tag

from ._base import _CamelModel
from .enums import (
    ConfigType,
    GitHubEventType,
    IntegrationType,
    RunHistoryActionType,
    WorkOSEventType,
)


class IntegrationDetails(_CamelModel):
    description: str
    isInput: bool | None = None
    isOutput: bool | None = None
    name: str
    type: IntegrationType


class ConfigDetails(_CamelModel):
    configType: ConfigType
    description: str
    integrationType: IntegrationType
    isInput: bool
    isOutput: bool
    name: str


# --- Per-config-type models (discriminated on configType) ---


class _BaseConfig(_CamelModel):
    integrationId: str
    integrationType: IntegrationType


class GmailConfigInstance(_BaseConfig):
    configType: Literal[ConfigType.GMAIL] = ConfigType.GMAIL


class GmailOutputConfigInstance(_BaseConfig):
    configType: Literal[ConfigType.GMAIL_OUTPUT] = ConfigType.GMAIL_OUTPUT


class GmailDraftOutputConfigInstance(_BaseConfig):
    configType: Literal[ConfigType.GMAIL_DRAFT_OUTPUT] = ConfigType.GMAIL_DRAFT_OUTPUT


class FigmaConfigInstance(_BaseConfig):
    configType: Literal[ConfigType.FIGMA] = ConfigType.FIGMA
    fileKey: str
    fileName: str | None = None
    teamId: str


class SlackConfigInstance(_BaseConfig):
    configType: Literal[ConfigType.SLACK] = ConfigType.SLACK
    channelId: str | None = None
    channelName: str | None = None
    listenToUserDms: bool | None = None
    userIds: list[str] | None = None


class SlackOutputConfigInstance(_BaseConfig):
    configType: Literal[ConfigType.SLACK_OUTPUT] = ConfigType.SLACK_OUTPUT
    channelId: str | None = None
    channelName: str | None = None
    listenToUserDms: bool | None = None
    userIds: list[str] | None = None


class NotionConfigInstance(_BaseConfig):
    configType: Literal[ConfigType.NOTION] = ConfigType.NOTION
    databaseIds: list[str] = Field(default_factory=list)
    databaseNames: list[str] = Field(default_factory=list)
    pageIds: list[str] = Field(default_factory=list)
    pageNames: list[str] = Field(default_factory=list)


class LinearInputConfigInstance(_BaseConfig):
    configType: Literal[ConfigType.LINEAR_INPUT] = ConfigType.LINEAR_INPUT
    projectId: str | None = None
    projectName: str | None = None


class LinearOutputConfigInstance(_BaseConfig):
    configType: Literal[ConfigType.LINEAR_OUTPUT] = ConfigType.LINEAR_OUTPUT
    teamId: str | None = None
    teamName: str | None = None
    projectId: str | None = None
    projectName: str | None = None


class GitHubConfigInstance(_BaseConfig):
    configType: Literal[ConfigType.GITHUB] = ConfigType.GITHUB
    repositoryIds: list[int]
    eventTypes: list[GitHubEventType] | None = None


class JiraConfigInstance(_BaseConfig):
    configType: Literal[ConfigType.JIRA] = ConfigType.JIRA
    projectKey: str | None = None
    projectId: str | None = None


class ConfluenceConfigInstance(_BaseConfig):
    configType: Literal[ConfigType.CONFLUENCE] = ConfigType.CONFLUENCE
    spaceName: str
    spaceId: str
    pageId: str
    pageName: str


class PosthogConfigInstance(_BaseConfig):
    configType: Literal[ConfigType.POSTHOG] = ConfigType.POSTHOG
    projectId: str
    projectName: str | None = None


class DatadogConfigInstance(_BaseConfig):
    configType: Literal[ConfigType.DATADOG] = ConfigType.DATADOG
    defaultIndexes: list[str] = Field(default_factory=lambda: ["main"])


class TimeTriggerConfigInstance(_BaseConfig):
    configType: Literal[ConfigType.TIME_TRIGGER] = ConfigType.TIME_TRIGGER
    cronExpression: str


class LaunchDarklyConfigInstance(_BaseConfig):
    configType: Literal[ConfigType.LAUNCHDARKLY] = ConfigType.LAUNCHDARKLY
    projectKey: str
    environmentKeys: list[str]


class TerseConfigInstance(_BaseConfig):
    configType: Literal[ConfigType.TERSE] = ConfigType.TERSE


class WorkOSInputConfigInstance(_BaseConfig):
    configType: Literal[ConfigType.WORKOS_INPUT] = ConfigType.WORKOS_INPUT
    eventTypes: list[WorkOSEventType] = Field(default_factory=list)


class WorkOSOutputConfigInstance(_BaseConfig):
    configType: Literal[ConfigType.WORKOS_OUTPUT] = ConfigType.WORKOS_OUTPUT


class AttioOutputConfigInstance(_BaseConfig):
    configType: Literal[ConfigType.ATTIO_OUTPUT] = ConfigType.ATTIO_OUTPUT
    objectSlug: str | None = None


class SnowflakeOutputConfigInstance(_BaseConfig):
    configType: Literal[ConfigType.SNOWFLAKE_OUTPUT] = ConfigType.SNOWFLAKE_OUTPUT


ConfigInstance = Annotated[
    Annotated[GmailConfigInstance, Tag(ConfigType.GMAIL)]
    | Annotated[GmailOutputConfigInstance, Tag(ConfigType.GMAIL_OUTPUT)]
    | Annotated[GmailDraftOutputConfigInstance, Tag(ConfigType.GMAIL_DRAFT_OUTPUT)]
    | Annotated[FigmaConfigInstance, Tag(ConfigType.FIGMA)]
    | Annotated[SlackConfigInstance, Tag(ConfigType.SLACK)]
    | Annotated[SlackOutputConfigInstance, Tag(ConfigType.SLACK_OUTPUT)]
    | Annotated[NotionConfigInstance, Tag(ConfigType.NOTION)]
    | Annotated[LinearInputConfigInstance, Tag(ConfigType.LINEAR_INPUT)]
    | Annotated[LinearOutputConfigInstance, Tag(ConfigType.LINEAR_OUTPUT)]
    | Annotated[GitHubConfigInstance, Tag(ConfigType.GITHUB)]
    | Annotated[JiraConfigInstance, Tag(ConfigType.JIRA)]
    | Annotated[ConfluenceConfigInstance, Tag(ConfigType.CONFLUENCE)]
    | Annotated[PosthogConfigInstance, Tag(ConfigType.POSTHOG)]
    | Annotated[DatadogConfigInstance, Tag(ConfigType.DATADOG)]
    | Annotated[TimeTriggerConfigInstance, Tag(ConfigType.TIME_TRIGGER)]
    | Annotated[LaunchDarklyConfigInstance, Tag(ConfigType.LAUNCHDARKLY)]
    | Annotated[TerseConfigInstance, Tag(ConfigType.TERSE)]
    | Annotated[WorkOSInputConfigInstance, Tag(ConfigType.WORKOS_INPUT)]
    | Annotated[WorkOSOutputConfigInstance, Tag(ConfigType.WORKOS_OUTPUT)]
    | Annotated[AttioOutputConfigInstance, Tag(ConfigType.ATTIO_OUTPUT)]
    | Annotated[SnowflakeOutputConfigInstance, Tag(ConfigType.SNOWFLAKE_OUTPUT)],
    Discriminator(lambda v: v.get("configType") if isinstance(v, dict) else getattr(v, "configType", None)),
]


class NotificationSettings(_CamelModel):
    agentDefaultNotifications: list[RunHistoryActionType]
    id: str
    weeklyAgentImprovements: bool


__all__ = [
    "AttioOutputConfigInstance",
    "ConfigDetails",
    "ConfigInstance",
    "ConfluenceConfigInstance",
    "DatadogConfigInstance",
    "FigmaConfigInstance",
    "GitHubConfigInstance",
    "GmailConfigInstance",
    "GmailDraftOutputConfigInstance",
    "GmailOutputConfigInstance",
    "IntegrationDetails",
    "JiraConfigInstance",
    "LaunchDarklyConfigInstance",
    "LinearInputConfigInstance",
    "LinearOutputConfigInstance",
    "NotificationSettings",
    "NotionConfigInstance",
    "PosthogConfigInstance",
    "SlackConfigInstance",
    "SlackOutputConfigInstance",
    "SnowflakeOutputConfigInstance",
    "TerseConfigInstance",
    "TimeTriggerConfigInstance",
    "WorkOSInputConfigInstance",
    "WorkOSOutputConfigInstance",
]
