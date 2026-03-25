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
    finalOutput: str
    type: Literal["final_output"]


class SdkAgentStreamEventToolCallParams(_CamelModel):
    toolCallParams: str
    type: Literal["tool_call_params"]


class SdkAgentStreamEventToolCallStarted(_CamelModel):
    toolCallStarted: str
    type: Literal["tool_call_started"]


class SdkAgentStreamEventToolCallCompleted(_CamelModel):
    toolCallCompleted: str
    type: Literal["tool_call_completed"]


class SdkAgentStreamEventAction(_CamelModel):
    action: RunHistoryAction
    type: Literal["action"]


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
    "SdkAgentStreamEventText",
    "SdkAgentStreamEventToolCallCompleted",
    "SdkAgentStreamEventToolCallParams",
    "SdkAgentStreamEventToolCallStarted",
]
