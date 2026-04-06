"""Integration and config models."""

from __future__ import annotations

from typing import Annotated, Any

from pydantic import Discriminator, Tag

from ._base import TerseModel
from ._generated import (
    AttioOutputConfigInstance,
    ConfluenceConfigInstance,
    DatadogConfigInstance,
    FigmaConfigInstance,
    GitHubConfigInstance,
    GmailConfigInstance,
    GmailDraftOutputConfigInstance,
    GmailOutputConfigInstance,
    JiraConfigInstance,
    LaunchDarklyConfigInstance,
    LinearInputConfigInstance,
    LinearOutputConfigInstance,
    NotionConfigInstance,
    PosthogConfigInstance,
    SlackConfigInstance,
    SlackOutputConfigInstance,
    SnowflakeOutputConfigInstance,
    TerseConfigInstance,
    TimeTriggerConfigInstance,
    WorkOSInputConfigInstance,
    WorkOSOutputConfigInstance,
)
from .enums import (
    ConfigType,
    IntegrationType,
    RunHistoryActionType,
)


def _config_type_discriminator(value: Any) -> str | None:
    if isinstance(value, dict):
        raw_value = value.get("configType", value.get("config_type"))
    else:
        raw_value = getattr(value, "config_type", getattr(value, "configType", None))

    if raw_value is None:
        return None

    return str(raw_value)


class IntegrationDetails(TerseModel):
    description: str
    is_input: bool | None = None
    is_output: bool | None = None
    name: str
    type: IntegrationType


class ConfigDetails(TerseModel):
    config_type: ConfigType
    description: str
    integration_type: IntegrationType
    is_input: bool
    is_output: bool
    name: str


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
    Discriminator(_config_type_discriminator),
]


class NotificationSettings(TerseModel):
    agent_default_notifications: list[RunHistoryActionType]
    id: str
    weekly_agent_improvements: bool


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
