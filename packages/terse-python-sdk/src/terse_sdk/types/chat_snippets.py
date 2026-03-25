"""Chat snippet models."""

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import Field, RootModel

from ._base import _CamelModel


class MultipleChoiceOption(_CamelModel):
    label: str
    value: str


class ChatSnippetButton(_CamelModel):
    id: str | None = None
    label: str
    selectedValue: str | None = None
    step_id: str | None = None
    type: Literal["button"]
    url: str


class ChatSnippetIntegrationPrompt(_CamelModel):
    id: str | None = None
    integration: str
    message: str
    selectedValue: str | None = None
    stateToken: str | None = None
    step_id: str | None = None
    type: Literal["integration_prompt"]


class ChatSnippetNavigate(_CamelModel):
    id: str | None = None
    path: str
    selectedValue: str | None = None
    step_id: str | None = None
    type: Literal["navigate"]


class ChatSnippetMultipleChoice(_CamelModel):
    allowMultiple: bool | None = None
    id: str | None = None
    options: list[MultipleChoiceOption]
    question: str
    questionId: str
    selectedValue: str | None = None
    step_id: str | None = None
    type: Literal["multiple_choice"]


class ChatSnippetImage(_CamelModel):
    id: str | None = None
    selectedValue: str | None = None
    step_id: str | None = None
    type: Literal["image"]
    url: str


class ChatSnippet(
    RootModel[
        ChatSnippetButton
        | ChatSnippetIntegrationPrompt
        | ChatSnippetNavigate
        | ChatSnippetMultipleChoice
        | ChatSnippetImage
    ]
):
    root: Annotated[
        ChatSnippetButton
        | ChatSnippetIntegrationPrompt
        | ChatSnippetNavigate
        | ChatSnippetMultipleChoice
        | ChatSnippetImage,
        Field(discriminator="type"),
    ]


__all__ = [
    "ChatSnippet",
    "ChatSnippetButton",
    "ChatSnippetImage",
    "ChatSnippetIntegrationPrompt",
    "ChatSnippetMultipleChoice",
    "ChatSnippetNavigate",
    "MultipleChoiceOption",
]
