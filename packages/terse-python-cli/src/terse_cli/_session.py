"""Helpers for consuming backend session streams during local test runs."""

from __future__ import annotations

import json
import logging
import threading
from collections.abc import Callable, Iterator
from contextlib import ExitStack
from dataclasses import dataclass

import httpx
from httpx_sse import connect_sse
from pydantic import ValidationError
from terse_sdk import SdkAgentStreamEvent, TerseSettings

from ._debug import (
    _debug_log_request,
    _debug_log_response_metadata,
    _read_error_detail,
)

LOGGER = logging.getLogger("terse.cli.session")


class SessionStreamError(RuntimeError):
    """Raised when a session event stream could not be opened."""


@dataclass
class SessionStream:
    """A live backend session stream with background event consumption."""

    session_id: str
    _exit_stack: ExitStack
    _thread: threading.Thread

    def close(self) -> None:
        self._exit_stack.close()
        self._thread.join(timeout=1.0)


def open_session_stream(
    api_key: str,
    on_event: Callable[[object], None],
) -> SessionStream:
    """Open ``/sdk/session-events`` and start streaming events in the background."""

    settings = TerseSettings()
    exit_stack = ExitStack()

    try:
        client = exit_stack.enter_context(httpx.Client(timeout=None))
        url = f"{settings.backend_url.rstrip('/')}/sdk/session-events"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Accept": "text/event-stream",
        }
        _debug_log_request(LOGGER, "GET", url, headers)
        event_source = exit_stack.enter_context(
            connect_sse(
                client,
                "GET",
                url,
                headers=headers,
            )
        )
        _assert_session_response(event_source.response)

        iterator = event_source.iter_sse()
        session_id = _read_session_id(iterator)
        thread = threading.Thread(
            target=_consume_session_events,
            args=(iterator, on_event),
            daemon=True,
        )
        thread.start()
        return SessionStream(session_id=session_id, _exit_stack=exit_stack, _thread=thread)
    except Exception:
        exit_stack.close()
        raise


def _assert_session_response(response: httpx.Response) -> None:
    _debug_log_response_metadata(LOGGER, response, "/sdk/session-events")
    if response.is_error:
        detail = _read_error_detail(response)
        if detail:
            LOGGER.debug("Response detail from /sdk/session-events:\n%s", detail)
        raise SessionStreamError(
            f"{response.status_code} {response.reason_phrase} — /sdk/session-events"
            + (f"\n  {detail}" if detail else "")
        )

    content_type = response.headers.get("Content-Type", "")
    if "text/event-stream" not in content_type:
        raise SessionStreamError(
            f"Expected text/event-stream from /sdk/session-events but got {content_type or 'unknown content-type'}."
        )


def _read_session_id(iterator: Iterator[object]) -> str:
    for sse in iterator:
        data = getattr(sse, "data", "")
        if not data:
            continue
        try:
            payload = json.loads(data)
        except json.JSONDecodeError:
            continue

        if isinstance(payload, dict) and payload.get("type") == "session_started":
            session_id = payload.get("sessionId")
            if isinstance(session_id, str) and session_id:
                LOGGER.debug("Opened session stream with sessionId=%s", session_id)
                return session_id

    raise SessionStreamError("Session stream ended before sending sessionId.")


def _consume_session_events(iterator: Iterator[object], on_event: Callable[[object], None]) -> None:
    try:
        for sse in iterator:
            data = getattr(sse, "data", "")
            if not data:
                continue
            try:
                event = SdkAgentStreamEvent.model_validate_json(data).root
            except ValidationError:
                continue
            on_event(event)
    except Exception as exc:
        LOGGER.debug("Session event consumer stopped unexpectedly: %s", exc)


