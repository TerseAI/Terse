"""Enum-like literal aliases shared across SDK DTOs."""

from __future__ import annotations

from ._generated import (
    ApprovalActionType,
    ApprovalRequestStatus,
    ChangeEventType,
    EntityType,
    FigmaEventType,
    GitHubEventType,
    GmailEventType,
    JiraEventType,
    LinearEventType,
    NotificationDestinationType,
    RunHistoryActionType,
    RunHistoryDecisionAction,
    RunHistoryStatus,
    SlackChannelType,
    SlackEventType,
    ToolCallExecutionStatus,
    WorkOSEventType,
)
from ._generated import (
    ConfigTypeEnum as ConfigType,
)
from ._generated import (
    IntegrationTypeEnum as IntegrationType,
)

__all__ = [
    "ApprovalActionType",
    "ApprovalRequestStatus",
    "ChangeEventType",
    "ConfigType",
    "EntityType",
    "FigmaEventType",
    "GitHubEventType",
    "GmailEventType",
    "IntegrationType",
    "JiraEventType",
    "LinearEventType",
    "NotificationDestinationType",
    "RunHistoryActionType",
    "RunHistoryDecisionAction",
    "RunHistoryStatus",
    "SlackChannelType",
    "SlackEventType",
    "ToolCallExecutionStatus",
    "WorkOSEventType",
]
