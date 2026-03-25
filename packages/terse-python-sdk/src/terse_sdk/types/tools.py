"""Tool output models."""

from __future__ import annotations

from typing import Any

from ._base import _CamelModel
from .attio import AttioObjectWithAttributes, AttioRecord
from .run_history import RunHistoryAction


class ToolOutputBase(_CamelModel):
    actions: list[RunHistoryAction] | None = None
    success: bool


class AttioListObjectsToolOutput(ToolOutputBase):
    count: float
    objects: list[AttioObjectWithAttributes]


class AttioQueryRecordsToolOutput(ToolOutputBase):
    count: float
    records: list[AttioRecord]


class AttioUpsertRecordToolOutput(ToolOutputBase):
    record: AttioRecord | None = None


class SnowflakeExecuteQueryToolOutput(ToolOutputBase):
    columns: list[str]
    rowCount: float
    rows: list[dict[str, Any]]


class SnowflakeExplainQueryToolOutput(ToolOutputBase):
    columns: list[str]
    explainPlan: list[dict[str, Any]]
    rowCount: float


__all__ = [
    "AttioListObjectsToolOutput",
    "AttioQueryRecordsToolOutput",
    "AttioUpsertRecordToolOutput",
    "SnowflakeExecuteQueryToolOutput",
    "SnowflakeExplainQueryToolOutput",
    "ToolOutputBase",
]
