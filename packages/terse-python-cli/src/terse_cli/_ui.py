"""Shared terminal UI helpers for the CLI."""

from __future__ import annotations

import json
from collections.abc import Sequence
from typing import TypeVar

import questionary
from rich.console import Console
from terse_sdk import (
    SdkAgentStreamEventAction,
    SdkAgentStreamEventFinalOutput,
    SdkAgentStreamEventText,
    SdkAgentStreamEventToolCallCompleted,
    SdkAgentStreamEventToolCallParams,
    SdkAgentStreamEventToolCallStarted,
)

console = Console()

ChoiceT = TypeVar("ChoiceT")


class PromptCancelledError(RuntimeError):
    """Raised when an interactive prompt is cancelled."""


def prompt_select(message: str, choices: Sequence[tuple[str, ChoiceT]]) -> ChoiceT:
    """Prompt the user to select one value from a list of labeled choices."""

    answer = questionary.select(
        message,
        choices=[questionary.Choice(title=label, value=value) for label, value in choices],
    ).ask()
    if answer is None:
        raise PromptCancelledError("Selection cancelled.")
    return answer


def log_stream_event(event: object) -> None:
    """Render agent/session stream events in a compact terminal format."""

    if isinstance(event, SdkAgentStreamEventText):
        return

    if isinstance(event, SdkAgentStreamEventToolCallParams) and event.toolCallParams.strip():
        console.print(f"  [cyan][tool:params][/cyan] {event.toolCallParams}")
        return

    if isinstance(event, SdkAgentStreamEventToolCallStarted):
        console.print(f"  [blue][tool:start][/blue] {event.toolCallStarted}")
        return

    if isinstance(event, SdkAgentStreamEventToolCallCompleted):
        payload = _parse_tool_completion(event.toolCallCompleted)
        tool_name = payload.get("tool", "unknown_tool")
        status = payload.get("status", "unknown")
        color = "green" if status == "completed" else "red"
        console.print(f"  [blue][tool:done][/blue] {tool_name} ([{color}]{status}[/{color}])")
        return

    if isinstance(event, SdkAgentStreamEventAction):
        action_data = event.action.model_dump(exclude_none=True)
        action_name = str(action_data.get("action") or action_data.get("type") or "action")
        target = f" -> {action_data['target']}" if action_data.get("target") else ""
        console.print(f"  [magenta][action][/magenta] {action_name}{target}")
        return

    if isinstance(event, SdkAgentStreamEventFinalOutput):
        console.print("")
        console.print("[green][final_output][/green]")
        console.print(event.finalOutput)
        console.print("")


def _parse_tool_completion(raw: str) -> dict[str, str]:
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        return {}

    if isinstance(payload, dict):
        return {str(key): str(value) for key, value in payload.items() if value is not None}
    return {}
