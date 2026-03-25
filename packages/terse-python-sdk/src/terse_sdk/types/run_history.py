"""Run history and approval models."""

from __future__ import annotations

from ._base import _CamelModel
from .enums import (
    ApprovalActionType,
    ApprovalRequestStatus,
    ChangeEventType,
    ConfigType,
    EntityType,
    IntegrationType,
    RunHistoryActionType,
    RunHistoryDecisionAction,
    RunHistoryStatus,
)


class OutputItem(_CamelModel):
    output_item_id: str
    output_item_type: ConfigType


class RunHistoryTrigger(_CamelModel):
    event: str
    integration: IntegrationType
    source: str
    subheader: str | None = None
    title: str | None = None
    url: str | None = None


class ApprovalAction(_CamelModel):
    deepLink: str
    label: str
    type: ApprovalActionType


class ApprovalRequest(_CamelModel):
    actions: list[ApprovalAction]
    agentId: str
    icon: IntegrationType
    id: str
    runId: str
    status: ApprovalRequestStatus
    subheader: str
    timestamp: str
    title: str


class ChangedItem(_CamelModel):
    change_event_type: ChangeEventType
    id: str
    type_name: EntityType


class RunHistoryAction(_CamelModel):
    action: str
    details: str
    integration: IntegrationType
    isReadOnly: bool | None = None
    output_items: list[OutputItem] | None = None
    step_id: str | None = None
    target: str
    type: RunHistoryActionType
    url: str | None = None


class RunHistoryDecision(_CamelModel):
    action: RunHistoryDecisionAction
    reasoning: str


class RunHistoryRecord(_CamelModel):
    actions: list[RunHistoryAction] | None = None
    agentId: str
    decision: RunHistoryDecision
    filtered: bool
    id: str
    isManuallyTriggered: bool
    status: RunHistoryStatus
    timestamp: str
    trigger: RunHistoryTrigger


__all__ = [
    "ApprovalAction",
    "ApprovalRequest",
    "ChangedItem",
    "OutputItem",
    "RunHistoryAction",
    "RunHistoryDecision",
    "RunHistoryRecord",
    "RunHistoryTrigger",
]
