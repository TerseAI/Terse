"""Job definition models for the Python SDK."""

from __future__ import annotations

from typing import Any

from pydantic import Field

from ._base import TerseModel


class TriggerConfig(TerseModel):
    integration_id: str
    integration_type: str
    event_type: str | None = None
    config_type: str | None = None
    config: dict[str, Any] = Field(default_factory=dict)


class SkillConfig(TerseModel):
    integration_id: str
    integration_type: str
    config_type: str
    config: dict[str, Any] = Field(default_factory=dict)


class JobDefinition(TerseModel):
    name: str
    triggers: list[TriggerConfig] = Field(default_factory=list)
    skills: list[SkillConfig] = Field(default_factory=list)


__all__ = ["JobDefinition", "SkillConfig", "TriggerConfig"]
