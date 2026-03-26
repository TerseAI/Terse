"""Job definition models for the Python SDK."""

from __future__ import annotations

from typing import Any, Generic, TypeVar

from pydantic import Field

from ._base import TerseModel

_TToolName = TypeVar("_TToolName", bound=str, covariant=True)


class TriggerConfig(TerseModel):
    integration_id: str
    integration_type: str
    event_type: str | None = None
    config_type: str | None = None
    config: dict[str, Any] = Field(default_factory=dict)


class SkillConfig(TerseModel, Generic[_TToolName]):
    integration_id: str
    integration_type: str
    config_type: str
    config: dict[str, Any] = Field(default_factory=dict)


class JobDefinition(TerseModel, Generic[_TToolName]):
    name: str
    triggers: list[TriggerConfig] = Field(default_factory=list)
    skills: list[SkillConfig[_TToolName]] = Field(default_factory=list)


__all__ = ["JobDefinition", "SkillConfig", "TriggerConfig"]
