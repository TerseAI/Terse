"""Debug logging helpers and shared HTTP utilities for the Terse Python CLI."""

from __future__ import annotations

import json
import logging
import sys

import httpx


def configure_debug_logging(enabled: bool) -> None:
    """Configure the shared ``terse`` logger tree for CLI debug output."""

    logger = logging.getLogger("terse")
    logger.handlers.clear()
    logger.propagate = False

    if enabled:
        handler = logging.StreamHandler(sys.stderr)
        handler.setFormatter(logging.Formatter("[debug] %(message)s"))
        logger.addHandler(handler)
        logger.setLevel(logging.DEBUG)
        logger.debug("Debug logging enabled.")
        return

    logger.addHandler(logging.NullHandler())
    logger.setLevel(logging.CRITICAL + 1)


# ---------------------------------------------------------------------------
# Shared HTTP utilities (used by _http.py and _session.py)
# ---------------------------------------------------------------------------


def _redact_headers(headers: dict[str, str]) -> dict[str, str]:
    redacted: dict[str, str] = {}
    for key, value in headers.items():
        if key.lower() == "authorization":
            redacted[key] = "Bearer ***"
            continue
        redacted[key] = value
    return redacted


def _format_debug_value(value: object) -> str:
    try:
        return json.dumps(value, indent=2, sort_keys=True, default=str)
    except TypeError:
        return str(value)


def _buffer_response_content(response: httpx.Response) -> None:
    response.read()


def _read_error_detail(response: httpx.Response) -> str:
    _buffer_response_content(response)
    try:
        payload = response.json()
    except ValueError:
        return response.text.strip()

    if isinstance(payload, dict):
        detail = payload.get("error")
        if detail is not None:
            return str(detail)
    return response.text.strip()


def _debug_log_request(
    logger: logging.Logger,
    method: str,
    url: str,
    headers: dict[str, str],
    payload: object | None = None,
) -> None:
    if not logger.isEnabledFor(logging.DEBUG):
        return

    logger.debug("HTTP %s %s", method, url)
    logger.debug("Request headers:\n%s", _format_debug_value(_redact_headers(headers)))
    if payload is not None:
        logger.debug("Request payload:\n%s", _format_debug_value(payload))


def _debug_log_response_metadata(
    logger: logging.Logger,
    response: httpx.Response,
    path: str,
) -> None:
    if not logger.isEnabledFor(logging.DEBUG):
        return

    logger.debug("Response %s %s for %s", response.status_code, response.reason_phrase, path)
    logger.debug("Response headers:\n%s", _format_debug_value(dict(response.headers)))


def _debug_log_response_payload(
    logger: logging.Logger,
    path: str,
    payload: object,
) -> None:
    if not logger.isEnabledFor(logging.DEBUG):
        return

    logger.debug("Response payload from %s:\n%s", path, _format_debug_value(payload))
