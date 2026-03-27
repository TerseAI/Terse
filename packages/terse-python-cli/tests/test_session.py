# ruff: noqa: E501
from __future__ import annotations

import json

import httpx
import pytest
from terse_cli._session import SessionStreamError, _assert_session_response


def test_assert_session_response_reads_streaming_error_detail() -> None:
    response = httpx.Response(
        401,
        headers={"Content-Type": "application/json"},
        stream=httpx.ByteStream(json.dumps({"error": "unauthorized"}).encode("utf-8")),
        request=httpx.Request("GET", "https://example.com/sdk/session-events"),
    )

    with pytest.raises(SessionStreamError) as exc_info:
        _assert_session_response(response)

    assert "unauthorized" in str(exc_info.value)
