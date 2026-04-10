"""
Errors raised by the Terse Python SDK.
"""


class TerseRuntimeError(RuntimeError):
    """Base runtime error for the Python SDK."""


class MissingApiKeyError(TerseRuntimeError):
    """Raised when a command requires ``TERSE_API_KEY`` and it is missing."""


class TerseApiError(TerseRuntimeError):
    """Raised when a backend request fails."""
