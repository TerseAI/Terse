"""Model event DTOs."""

from __future__ import annotations

from typing import Annotated, Any, Literal

from pydantic import Field, RootModel

from ._base import _CamelModel
from .chat_snippets import ChatSnippet
from .enums import ToolCallExecutionStatus
from .run_history import ChangedItem


class Error(_CamelModel):
    message: str
    name: str
    stack: str | None = None


class RunError(_CamelModel):
    code: str | None = None
    error: str
    timestamp: float


class ToolCall(_CamelModel):
    integration: str
    parameters: str
    step_id: str
    summary: str
    timestamp: float


class TextDelta(_CamelModel):
    delta: str
    step_id: str
    timestamp: float


class SharedErrorContext(_CamelModel):
    error: Error | Any


class ModelEventToolApprovalResponse(_CamelModel):
    approved: bool
    step_id: str
    timestamp: float
    type: Literal["ToolApprovalResponse"]


class ModelEventToolApprovalRequest(_CamelModel):
    arguments: str
    name: str
    step_id: str
    timestamp: float
    type: Literal["ToolApprovalRequest"]


class ModelEventToolCallGenerating(_CamelModel):
    step_id: str
    timestamp: float
    tool_name: str
    type: Literal["ToolCallGenerating"]


class ModelEventToolCall(_CamelModel):
    integration: str
    parameters: str
    step_id: str
    summary: str
    timestamp: float
    type: Literal["ToolCall"]


class ModelEventToolCallComplete(_CamelModel):
    changed_items: list[ChangedItem]
    errorContext: SharedErrorContext | None = None
    integration: str
    result: str | None = None
    status: ToolCallExecutionStatus
    step_id: str
    timestamp: float
    tool_name: str
    type: Literal["ToolCallComplete"]
    url: str | None = None


class ModelEventTextDelta(_CamelModel):
    delta: str
    step_id: str
    timestamp: float
    type: Literal["TextDelta"]


class ModelEventRunError(_CamelModel):
    code: str | None = None
    error: str
    timestamp: float
    type: Literal["RunError"]


class ModelEventCancelled(_CamelModel):
    reason: str | None = None
    timestamp: float
    type: Literal["Cancelled"]


class ModelEventNaturalStop(_CamelModel):
    step_id: str
    timestamp: float
    type: Literal["NaturalStop"]


class ModelEventFilterResult(_CamelModel):
    confidence: float
    isRelevant: bool
    reason: str
    step_id: str
    timestamp: float
    type: Literal["FilterResult"]


class ModelEventUserMessage(_CamelModel):
    client_turn_id: str
    message: str
    step_id: str
    timestamp: float
    type: Literal["UserMessage"]


class ModelEventThinking(_CamelModel):
    step_id: str
    timestamp: float
    type: Literal["Thinking"]


class ModelEventSnippet(_CamelModel):
    snippet: ChatSnippet
    timestamp: float
    type: Literal["Snippet"]


class ModelEvent(
    RootModel[
        ModelEventToolApprovalResponse
        | ModelEventToolApprovalRequest
        | ModelEventToolCallGenerating
        | ModelEventToolCall
        | ModelEventToolCallComplete
        | ModelEventTextDelta
        | ModelEventRunError
        | ModelEventCancelled
        | ModelEventNaturalStop
        | ModelEventFilterResult
        | ModelEventUserMessage
        | ModelEventThinking
        | ModelEventSnippet
    ]
):
    root: Annotated[
        ModelEventToolApprovalResponse
        | ModelEventToolApprovalRequest
        | ModelEventToolCallGenerating
        | ModelEventToolCall
        | ModelEventToolCallComplete
        | ModelEventTextDelta
        | ModelEventRunError
        | ModelEventCancelled
        | ModelEventNaturalStop
        | ModelEventFilterResult
        | ModelEventUserMessage
        | ModelEventThinking
        | ModelEventSnippet,
        Field(discriminator="type"),
    ]


__all__ = [
    "Error",
    "ModelEvent",
    "ModelEventCancelled",
    "ModelEventFilterResult",
    "ModelEventNaturalStop",
    "ModelEventRunError",
    "ModelEventSnippet",
    "ModelEventTextDelta",
    "ModelEventThinking",
    "ModelEventToolApprovalRequest",
    "ModelEventToolApprovalResponse",
    "ModelEventToolCall",
    "ModelEventToolCallComplete",
    "ModelEventToolCallGenerating",
    "ModelEventUserMessage",
    "RunError",
    "SharedErrorContext",
    "TextDelta",
    "ToolCall",
]
