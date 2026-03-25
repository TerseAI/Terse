"""Shared model helpers for the Python SDK."""

from pydantic import BaseModel, ConfigDict


def to_camel(value: str) -> str:
    head, *tail = value.split("_")
    return head + "".join(part.capitalize() for part in tail)


class TerseModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, extra="forbid", populate_by_name=True)


class _CamelModel(BaseModel):
    model_config = ConfigDict(extra="forbid")
