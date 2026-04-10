"""Tool output models."""

from __future__ import annotations

from typing import Generic, TypeVar

from ._generated import (
    AttioListObjectsToolOutput,
    AttioQueryRecordsToolOutput,
    AttioUpsertError,
    AttioUpsertRecordToolOutput,
    SlackChannelListItem,
    SlackConversationMessage,
    SlackListChannelsToolOutput,
    SlackListUsersToolOutput,
    SlackReadConversationToolOutput,
    SlackSendMessageToolOutput,
    SlackUserResponse,
    SnowflakeExecuteQueryToolOutput,
    SnowflakeExplainQueryToolOutput,
    ToolOutputBase,
)
from .attio import AttioRecordIdentifier

_TValues = TypeVar("_TValues")


# --- Generic typed wrappers for per-object return types ---


class AttioTypedRecord(Generic[_TValues]):
    """An Attio record with typed, flattened values."""

    __slots__ = ("id", "created_at", "web_url", "values")

    def __init__(
        self,
        values: _TValues,
        id: AttioRecordIdentifier | None = None,
        created_at: str | None = None,
        web_url: str | None = None,
    ) -> None:
        self.id = id
        self.created_at = created_at
        self.web_url = web_url
        self.values = values


class AttioTypedQueryResult(Generic[_TValues]):
    """Query result with per-object typed records."""

    __slots__ = ("success", "count", "records")

    def __init__(
        self,
        success: bool,
        count: float,
        records: list[AttioTypedRecord[_TValues]],
    ) -> None:
        self.success = success
        self.count = count
        self.records = records


class AttioTypedUpsertResult(Generic[_TValues]):
    """Upsert result with per-object typed records."""

    __slots__ = (
        "success",
        "records",
        "count",
        "requested_count",
        "success_count",
        "failure_count",
        "partial",
        "errors",
    )

    def __init__(
        self,
        success: bool,
        records: list[AttioTypedRecord[_TValues]],
        count: int = 0,
        requested_count: int = 0,
        success_count: int = 0,
        failure_count: int = 0,
        partial: bool = False,
        errors: list[AttioUpsertError] | None = None,
    ) -> None:
        self.success = success
        self.records = records
        self.count = count
        self.requested_count = requested_count
        self.success_count = success_count
        self.failure_count = failure_count
        self.partial = partial
        self.errors = errors or []


__all__ = [
    "AttioListObjectsToolOutput",
    "AttioQueryRecordsToolOutput",
    "AttioTypedQueryResult",
    "AttioTypedRecord",
    "AttioTypedUpsertResult",
    "AttioUpsertError",
    "AttioUpsertRecordToolOutput",
    "SlackChannelListItem",
    "SlackConversationMessage",
    "SlackListChannelsToolOutput",
    "SlackListUsersToolOutput",
    "SlackReadConversationToolOutput",
    "SlackSendMessageToolOutput",
    "SlackUserResponse",
    "SnowflakeExecuteQueryToolOutput",
    "SnowflakeExplainQueryToolOutput",
    "ToolOutputBase",
]
