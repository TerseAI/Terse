"""Agent configuration models."""

from __future__ import annotations

from typing import Literal

from ._base import _CamelModel
from .enums import RunHistoryActionType
from .integrations import ConfigInstance


class AgentPrompt(_CamelModel):
    text: str


class AgentNotificationSettings(_CamelModel):
    actionTypes: list[RunHistoryActionType]
    enabled: bool


class AgentOutput(_CamelModel):
    config: ConfigInstance
    id: str


class AgentTrigger(_CamelModel):
    config: ConfigInstance
    id: str


class AgentUpdate(_CamelModel):
    isActive: bool | None = None
    name: str | None = None
    notificationSettings: AgentNotificationSettings | None = None
    outputs: list[AgentOutput] | None = None
    prompt: AgentPrompt | None = None
    requireApproval: bool | None = None
    toolApprovals: list[str] | None = None
    triggers: list[AgentTrigger] | None = None


class Agent(_CamelModel):
    createdByUserId: str
    id: str
    isActive: bool
    name: str
    notificationSettings: AgentNotificationSettings | None = None
    outputs: list[AgentOutput]
    prompt: AgentPrompt
    requireApproval: bool
    source: Literal["WEB_UI", "SDK"] | None = None
    toolApprovals: list[str] | None = None
    triggers: list[AgentTrigger]
    updatedAt: str | None = None


__all__ = [
    "Agent",
    "AgentNotificationSettings",
    "AgentOutput",
    "AgentPrompt",
    "AgentTrigger",
    "AgentUpdate",
]
