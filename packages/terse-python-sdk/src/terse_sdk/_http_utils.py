"""Shared HTTP debug and response-parsing utilities for the SDK."""

from __future__ import annotations

import json
import logging
from collections.abc import Mapping

import httpx


def _redact_headers(headers: Mapping[str, str]) -> dict[str, str]:
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


def _read_response_detail(response: httpx.Response) -> str:
    _buffer_response_content(response)
    try:
        payload = response.json()
    except ValueError:
        return response.text.strip()

    if isinstance(payload, dict):
        error = payload.get("error")
        details = payload.get("details")

        detail_parts: list[str] = []
        if error is not None:
            detail_parts.append(str(error))

        if isinstance(details, list):
            rendered = [str(item) for item in details if item is not None]
            if rendered:
                detail_parts.append("; ".join(rendered))
        elif details is not None:
            detail_parts.append(str(details))

        if detail_parts:
            if len(detail_parts) == 1:
                return detail_parts[0]
            return f"{detail_parts[0]} ({detail_parts[1]})"
    return response.text.strip()


def _debug_log_request(
    logger: logging.Logger,
    method: str,
    url: str,
    headers: Mapping[str, str],
    payload: object | None = None,
) -> None:
    if not logger.isEnabledFor(logging.DEBUG):
        return

    logger.debug("HTTP %s %s", method.upper(), url)
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
