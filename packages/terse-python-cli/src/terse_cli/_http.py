"""HTTP helpers for talking to the Terse backend."""

from __future__ import annotations

import json
from typing import Any, cast
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from terse_sdk import TerseSettings


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
    body: bytes | None = None
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Accept": "application/json",
    }

    if method == "GET" and params:
        url = f"{url}?{urlencode({key: value for key, value in params.items() if value is not None})}"
    elif params is not None:
        body = json.dumps(params).encode("utf-8")
        headers["Content-Type"] = "application/json"

    request = Request(url, data=body, headers=headers, method=method)

    try:
        with urlopen(request, timeout=20) as response:
            content_type = response.headers.get("Content-Type", "")
            raw_body = response.read().decode("utf-8")
    except HTTPError as exc:
        detail = _read_error_detail(exc)
        message = f"{exc.code} {exc.reason} — {path}"
        if detail:
            message = f"{message}\n  {detail}"
        if exc.code in {401, 403}:
            raise AuthenticationError(message) from exc
        raise ApiRequestError(message) from exc
    except (URLError, OSError) as exc:
        raise ApiRequestError(f"Could not connect to {backend_url()} — is the backend running?\n  {exc}") from exc

    if "application/json" not in content_type:
        raise ApiRequestError(
            f"Expected JSON from {path} but got {content_type or 'unknown content-type'}.\n"
            f"  Is the Terse backend running on {backend_url()}?"
        )

    try:
        return json.loads(raw_body)
    except json.JSONDecodeError as exc:
        raise ApiRequestError(f"Received invalid JSON from {path}.") from exc


def verify_api_key(api_key: str) -> str:
    """Validate an API key and return a friendly display name."""

    payload = request_json("/sdk/me", api_key)
    data = cast(dict[str, Any], payload) if isinstance(payload, dict) else {}
    return str(data.get("firstName") or data.get("displayName") or data.get("email") or "there")


def _read_error_detail(error: HTTPError) -> str:
    try:
        raw_body = error.read().decode("utf-8")
    except OSError:
        return ""

    try:
        parsed = json.loads(raw_body)
    except json.JSONDecodeError:
        return raw_body.strip()

    if isinstance(parsed, dict):
        detail = parsed.get("error")
        if detail is not None:
            return str(detail)
    return raw_body.strip()
