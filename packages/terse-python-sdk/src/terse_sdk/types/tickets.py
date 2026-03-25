"""Ticket and project models."""

from __future__ import annotations

from ._base import _CamelModel


class Assignee(_CamelModel):
    id: str
    name: str


class Label(_CamelModel):
    color: str
    id: str
    name: str


class Project(_CamelModel):
    id: str
    name: str


class State(_CamelModel):
    id: str
    name: str


class Team(_CamelModel):
    id: str
    key: str
    name: str


class Ticket(_CamelModel):
    assignee: Assignee | None = None
    createdAt: str
    description: str | None = None
    dueDate: str | None = None
    estimate: float | None = None
    id: str
    identifier: str
    labels: list[Label] | None = None
    priority: float | None = None
    project: Project | None = None
    state: State
    team: Team | None = None
    title: str
    updatedAt: str


class TicketState(_CamelModel):
    id: str
    name: str


__all__ = ["Assignee", "Label", "Project", "State", "Team", "Ticket", "TicketState"]
