"""HMAC utilities for verifying incoming Terse webhook requests."""

from __future__ import annotations

import hashlib
import hmac
import math
import time

TERSE_SIGNATURE_HEADER = "x-terse-signature"
TERSE_TIMESTAMP_HEADER = "x-terse-timestamp"
TERSE_SIGNATURE_VERSION = "v0"
_MAX_TIMESTAMP_AGE_SECONDS = 300


def _compute_request_signature(signing_secret: str, timestamp: int, body: str) -> str:
    base_string = f"{TERSE_SIGNATURE_VERSION}:{timestamp}:{body}"
    digest = hmac.new(signing_secret.encode(), base_string.encode(), hashlib.sha256).hexdigest()
    return f"{TERSE_SIGNATURE_VERSION}={digest}"


def compute_challenge_signature(signing_secret: str, challenge_token: str) -> str:
    """Compute the HMAC-SHA256 of a challenge token using the signing secret."""
    return hmac.new(signing_secret.encode(), challenge_token.encode(), hashlib.sha256).hexdigest()


def verify_incoming_request(
    signing_secret: str,
    headers: dict[str, str],
    raw_body: str,
) -> None:
    """Verify an incoming Terse request signature. Raises ``ValueError`` if invalid."""
    signature = headers.get(TERSE_SIGNATURE_HEADER)
    timestamp_str = headers.get(TERSE_TIMESTAMP_HEADER)
    if not signature or not timestamp_str:
        raise ValueError("Missing Terse signature headers")

    try:
        timestamp = int(timestamp_str)
    except ValueError:
        raise ValueError("Invalid Terse timestamp header")

    age = abs(math.floor(time.time()) - timestamp)
    if age > _MAX_TIMESTAMP_AGE_SECONDS:
        raise ValueError("Terse request timestamp is too old")

    expected = _compute_request_signature(signing_secret, timestamp, raw_body)
    if not hmac.compare_digest(signature, expected):
        raise ValueError("Invalid Terse request signature")
