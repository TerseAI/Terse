"""Enum-like literal aliases shared across SDK DTOs."""

from __future__ import annotations

from enum import StrEnum

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
    SlackReactionAddedTriggerChannelType as SlackChannelType,
)


class EventType(StrEnum):
    """Stream event type constants for agent runs."""

    RUN_STARTED = "run_started"
    TEXT = "text"
    FINAL_OUTPUT = "final_output"
    TOOL_CALL_PARAMS = "tool_call_params"
    TOOL_CALL_STARTED = "tool_call_started"
    TOOL_CALL_COMPLETED = "tool_call_completed"
    TOOL_APPROVAL_REQUESTED = "tool_approval_requested"
    ACTION = "action"


__all__ = [
    "EventType",
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
