"""Enum-like literal aliases shared across SDK DTOs."""

from __future__ import annotations

from ._generated import (
    ApprovalActionType,
    ApprovalRequestStatus,
    ChangeEventType,
    EntityType,
    GitHubEventType,
    GmailEventType,
    LinearEventType,
    NotificationDestinationType,
    RunHistoryActionType,
    RunHistoryDecisionAction,
    RunHistoryStatus,
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
from ._generated import (
    SlackReactionAddedTriggerEventChannelType as SlackChannelType,
)

__all__ = [
    "ApprovalActionType",
    "ApprovalRequestStatus",
    "ChangeEventType",
    "ConfigType",
    "EntityType",
    "GitHubEventType",
    "GmailEventType",
    "IntegrationType",
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
