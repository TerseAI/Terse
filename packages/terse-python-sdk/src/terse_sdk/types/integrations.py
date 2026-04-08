"""Integration and config models."""

from __future__ import annotations

from typing import Any

from ._base import TerseModel
from ._generated import (
    AgentNotificationSettings as NotificationSettings,
)
from ._generated import (
    AttioOutputConfigInstance,
    DatadogConfigInstance,
    FigmaConfigInstance,
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
from ._generated import (
    BaseConfigInstance as ConfigInstance,
)
from .enums import (
    ConfigType,
    IntegrationType,
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


__all__ = [
    "AttioOutputConfigInstance",
    "ConfigDetails",
    "ConfigInstance",
    "DatadogConfigInstance",
    "FigmaConfigInstance",
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
