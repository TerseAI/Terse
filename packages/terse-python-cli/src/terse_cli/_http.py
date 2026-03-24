"""HTTP helpers for talking to the Terse backend."""

from __future__ import annotations

import json
import logging
from typing import Any, cast

import httpx
from terse_sdk import TerseSettings

LOGGER = logging.getLogger("terse.cli.http")


class ApiRequestError(RuntimeError):
    """Raised when a backend request fails."""


class AuthenticationError(ApiRequestError):
    """Raised when the backend rejects the API token."""


def frontend_url() -> str:
    """Return the configured frontend URL."""

    return TerseSettings().frontend_url.rstrip("/")


def backend_url() -> str:
    """Return the configured backend URL."""

    return TerseSettings().backend_url.rstrip("/")


def request_json(
    path: str,
    api_key: str,
    *,
    method: str = "GET",
    params: dict[str, object] | None = None,
) -> object:
    """Send an authenticated JSON request to the backend."""

    url = f"{backend_url()}{path}"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Accept": "application/json",
    }
    request_method = method.upper()
    _debug_log_request(request_method, url, headers, params)

    try:
        with httpx.Client(timeout=20.0) as client:
            if request_method == "GET":
                query_params = _build_query_params(params)
                response = client.request(
                    request_method,
                    url,
                    headers=headers,
                    params=query_params,
                )
            else:
                response = client.request(request_method, url, headers=headers, json=params)
    except httpx.RequestError as exc:
        raise ApiRequestError(f"Could not connect to {backend_url()} — is the backend running?\n  {exc}") from exc

    _debug_log_response_metadata(response, path)

    if response.status_code in {401, 403}:
        detail = _read_error_detail(response)
        if detail:
            LOGGER.debug("Response detail from %s:\n%s", path, detail)
        message = f"{response.status_code} {response.reason_phrase} — {path}"
        if detail:
            message = f"{message}\n  {detail}"
        raise AuthenticationError(message)

    if response.is_error:
        detail = _read_error_detail(response)
        if detail:
            LOGGER.debug("Response detail from %s:\n%s", path, detail)
        message = f"{response.status_code} {response.reason_phrase} — {path}"
        if detail:
            message = f"{message}\n  {detail}"
        raise ApiRequestError(message)

    content_type = response.headers.get("Content-Type", "")
    if "application/json" not in content_type:
        raise ApiRequestError(
            f"Expected JSON from {path} but got {content_type or 'unknown content-type'}.\n"
            f"  Is the Terse backend running on {backend_url()}?"
        )

    try:
        payload = cast(object, response.json())
    except ValueError as exc:
        raise ApiRequestError(f"Received invalid JSON from {path}.") from exc

    _debug_log_response_payload(path, payload)
    return payload


def verify_api_key(api_key: str) -> str:
    """Validate an API key and return a friendly display name."""

    payload = request_json("/sdk/me", api_key)
    data = cast(dict[str, Any], payload) if isinstance(payload, dict) else {}
    return str(data.get("firstName") or data.get("displayName") or data.get("email") or "there")


def _read_error_detail(response: httpx.Response) -> str:
    try:
        parsed = response.json()
    except ValueError:
        return response.text.strip()

    if isinstance(parsed, dict):
        detail = parsed.get("error")
        if detail is not None:
            return str(detail)
    return response.text.strip()


def _build_query_params(
    params: dict[str, object] | None,
) -> dict[str, str | int | float | None] | None:
    if not params:
        return None

    query_params: dict[str, str | int | float | None] = {}
    for key, value in params.items():
        if value is None:
            continue
        if isinstance(value, str | int | float):
            query_params[key] = value
        else:
            query_params[key] = str(value)

    return query_params or None


def _debug_log_request(method: str, url: str, headers: dict[str, str], payload: object | None) -> None:
    if not LOGGER.isEnabledFor(logging.DEBUG):
        return

    LOGGER.debug("HTTP %s %s", method, url)
    LOGGER.debug("Request headers:\n%s", _format_debug_value(_redact_headers(headers)))
    if payload is not None:
        LOGGER.debug("Request payload:\n%s", _format_debug_value(payload))


def _debug_log_response_metadata(response: httpx.Response, path: str) -> None:
    if not LOGGER.isEnabledFor(logging.DEBUG):
        return

    LOGGER.debug("Response %s %s for %s", response.status_code, response.reason_phrase, path)
    LOGGER.debug("Response headers:\n%s", _format_debug_value(dict(response.headers)))


def _debug_log_response_payload(path: str, payload: object) -> None:
    if not LOGGER.isEnabledFor(logging.DEBUG):
        return

    LOGGER.debug("Response payload from %s:\n%s", path, _format_debug_value(payload))


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
