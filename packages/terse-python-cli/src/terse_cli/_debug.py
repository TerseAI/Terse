"""Debug logging helpers for the Terse Python CLI."""

from __future__ import annotations

import logging
import sys


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
