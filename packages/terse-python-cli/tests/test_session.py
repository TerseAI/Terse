# ruff: noqa: E501
from __future__ import annotations

import json
import unittest

import httpx
from terse_cli._session import SessionStreamError, _assert_session_response


class SessionTests(unittest.TestCase):
    def test_assert_session_response_reads_streaming_error_detail(self) -> None:
        response = httpx.Response(
            401,
            headers={"Content-Type": "application/json"},
            stream=httpx.ByteStream(json.dumps({"error": "unauthorized"}).encode("utf-8")),
            request=httpx.Request("GET", "https://example.com/sdk/session-events"),
        )

        with self.assertRaises(SessionStreamError) as exc_info:
            _assert_session_response(response)

        self.assertIn("unauthorized", str(exc_info.exception))


if __name__ == "__main__":
    unittest.main()
