"""Integration and config models."""

from __future__ import annotations

from ._base import _CamelModel
from .enums import ConfigType, IntegrationType, RunHistoryActionType


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


class ConfigInstance(_CamelModel):
    configType: ConfigType
    integrationId: str
    integrationType: IntegrationType


class NotificationSettings(_CamelModel):
    agentDefaultNotifications: list[RunHistoryActionType]
    id: str
    weeklyAgentImprovements: bool


__all__ = ["ConfigDetails", "ConfigInstance", "IntegrationDetails", "NotificationSettings"]
