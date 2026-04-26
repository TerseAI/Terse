"""Model event DTOs."""

from __future__ import annotations

from ._generated import (
    Cancelled,
    Error,
    FilterResult,
    ModelEvent,
    ModelEventChatSnippet,
    NaturalStop,
    RunError,
    SharedErrorContext,
    SnippetVariant,
    TextDelta,
    Thinking,
    ToolApprovalRequest,
    ToolApprovalResponse,
    ToolCall,
    ToolCallComplete,
    UserMessage,
)

__all__ = [
    "Error",
    "ModelEvent",
    "Cancelled",
    "FilterResult",
    "ModelEventChatSnippet",
    "NaturalStop",
    "RunError",
    "SnippetVariant",
    "TextDelta",
    "Thinking",
    "ToolApprovalRequest",
    "ToolApprovalResponse",
    "ToolCall",
    "ToolCallComplete",
    "UserMessage",
    "RunError",
    "SharedErrorContext",
    "TextDelta",
    "ToolCall",
]
