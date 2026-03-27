"""Streaming event models for SDK agent runs."""

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import Field, RootModel

from ._base import _CamelModel
from .run_history import RunHistoryAction


class SdkAgentStreamEventText(_CamelModel):
    text: str
    type: Literal["text"]


class SdkAgentStreamEventFinalOutput(_CamelModel):
    final_output: str
    type: Literal["final_output"]


class SdkAgentStreamEventToolCallParams(_CamelModel):
    tool_call_params: str
    type: Literal["tool_call_params"]


class SdkAgentStreamEventToolCallStarted(_CamelModel):
    tool_call_started: str
    type: Literal["tool_call_started"]


class SdkAgentStreamEventToolCallCompleted(_CamelModel):
    tool_call_completed: str
    type: Literal["tool_call_completed"]


class SdkAgentStreamEventAction(_CamelModel):
    action: RunHistoryAction
    type: Literal["action"]


class SdkAgentToolApprovalRequest(_CamelModel):
    arguments: str
    step_id: str
    tool_name: str


class SdkAgentStreamEventRunStarted(_CamelModel):
    run_id: str
    type: Literal["run_started"]


class SdkAgentStreamEventToolApprovalRequested(_CamelModel):
    tool_approval_requested: SdkAgentToolApprovalRequest
    type: Literal["tool_approval_requested"]


class SdkAgentStreamEventError(_CamelModel):
    message: str
    type: Literal["error"]


class SdkAgentStreamEventDone(_CamelModel):
    type: Literal["done"]


class SdkAgentStreamEvent(
    RootModel[
        SdkAgentStreamEventText
        | SdkAgentStreamEventFinalOutput
        | SdkAgentStreamEventToolCallParams
        | SdkAgentStreamEventToolCallStarted
        | SdkAgentStreamEventToolCallCompleted
        | SdkAgentStreamEventAction
        | SdkAgentStreamEventRunStarted
        | SdkAgentStreamEventToolApprovalRequested
        | SdkAgentStreamEventError
        | SdkAgentStreamEventDone
    ]
):
    root: Annotated[
        SdkAgentStreamEventText
        | SdkAgentStreamEventFinalOutput
        | SdkAgentStreamEventToolCallParams
        | SdkAgentStreamEventToolCallStarted
        | SdkAgentStreamEventToolCallCompleted
        | SdkAgentStreamEventAction
        | SdkAgentStreamEventRunStarted
        | SdkAgentStreamEventToolApprovalRequested
        | SdkAgentStreamEventError
        | SdkAgentStreamEventDone,
        Field(discriminator="type"),
    ]


__all__ = [
    "SdkAgentStreamEvent",
    "SdkAgentStreamEventAction",
    "SdkAgentStreamEventDone",
    "SdkAgentStreamEventError",
    "SdkAgentStreamEventFinalOutput",
    "SdkAgentToolApprovalRequest",
    "SdkAgentStreamEventRunStarted",
    "SdkAgentStreamEventText",
    "SdkAgentStreamEventToolApprovalRequested",
    "SdkAgentStreamEventToolCallCompleted",
    "SdkAgentStreamEventToolCallParams",
    "SdkAgentStreamEventToolCallStarted",
]
