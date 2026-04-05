"""Run history and approval models."""

from __future__ import annotations

from ._base import TerseModel
from ._generated import OutputItem, RunHistoryAction
from .enums import (
    ApprovalActionType,
    ApprovalRequestStatus,
    ChangeEventType,
    EntityType,
    IntegrationType,
    RunHistoryDecisionAction,
    RunHistoryStatus,
)


class RunHistoryTrigger(TerseModel):
    event: str
    integration: IntegrationType
    source: str
    subheader: str | None = None
    title: str | None = None
    url: str | None = None


class ApprovalAction(TerseModel):
    deep_link: str
    label: str
    type: ApprovalActionType


class ApprovalRequest(TerseModel):
    actions: list[ApprovalAction]
    agent_id: str
    icon: IntegrationType
    id: str
    run_id: str
    status: ApprovalRequestStatus
    subheader: str
    timestamp: str
    title: str


class ChangedItem(TerseModel):
    change_event_type: ChangeEventType
    id: str
    type_name: EntityType


class RunHistoryDecision(TerseModel):
    action: RunHistoryDecisionAction
    reasoning: str


class RunHistoryRecord(TerseModel):
    actions: list[RunHistoryAction] | None = None
    agent_id: str
    decision: RunHistoryDecision
    filtered: bool
    id: str
    is_manually_triggered: bool
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
