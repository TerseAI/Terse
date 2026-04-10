"""Integration and config models."""

from __future__ import annotations

from typing import Any

from ._base import TerseModel
from ._generated import (
    AgentNotificationSettings as NotificationSettings,
)
from ._generated import (
    AttioOutputConfigInstance,
    ConfigInstance,
    DatadogConfigInstance,
    GitHubConfigInstance,
    GmailConfigInstance,
    GmailDraftOutputConfigInstance,
    GmailOutputConfigInstance,
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
)


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


__all__ = [
    "AttioOutputConfigInstance",
    "ConfigDetails",
    "ConfigInstance",
    "DatadogConfigInstance",
    "GitHubConfigInstance",
    "GmailConfigInstance",
    "GmailDraftOutputConfigInstance",
    "GmailOutputConfigInstance",
    "IntegrationDetails",
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
