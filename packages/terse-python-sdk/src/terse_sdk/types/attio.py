"""Attio-related models."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel

from ._base import _CamelModel


class AttioAttribute(BaseModel):
    api_slug: str | None = None
    is_required: bool | None = None
    is_unique: bool | None = None
    title: str | None = None
    type: str | None = None


class AttioObjectWithAttributes(_CamelModel):
    api_slug: str
    attributes: list[AttioAttribute] | None = None
    plural_noun: str
    singular_noun: str


class AttioRecordIdentifier(BaseModel):
    object_id: str | None = None
    record_id: str | None = None
    workspace_id: str | None = None


class AttioRecord(BaseModel):
    created_at: str | None = None
    id: AttioRecordIdentifier | None = None
    values: dict[str, Any] | None = None
    web_url: str | None = None


class Repository(_CamelModel):
    id: float
    name: str
    owner: str


__all__ = [
    "AttioAttribute",
    "AttioObjectWithAttributes",
    "AttioRecord",
    "AttioRecordIdentifier",
    "Repository",
]
