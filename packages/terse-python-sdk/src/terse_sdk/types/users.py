"""User models for the Python SDK."""

from __future__ import annotations

from typing import Literal

from pydantic import RootModel

from ._base import _CamelModel


class Role(RootModel[Literal["admin", "user"]]):
    root: Literal["admin", "user"]


class User(_CamelModel):
    displayName: str
    displayPhotoUrl: str
    email: str
    firstName: str | None
    id: str
    lastName: str | None
    organizationId: str
    organizationName: str
    roles: list[Role]
    workosId: str


class UserNoOrganization(_CamelModel):
    displayName: str
    displayPhotoUrl: str
    email: str
    firstName: str | None
    id: str
    lastName: str | None
    workosId: str


__all__ = ["Role", "User", "UserNoOrganization"]
