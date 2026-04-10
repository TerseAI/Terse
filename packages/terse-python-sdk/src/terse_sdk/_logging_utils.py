import logging

from ._env import _is_truthy_env

LOGGER = logging.getLogger("terse.sdk.runtime")


def _configure_debug_logging() -> None:
    if not (_is_truthy_env("TERSE_DEBUG") or _is_truthy_env("TERSE_SDK_DEBUG")):
        return

    LOGGER.setLevel(logging.DEBUG)

    if LOGGER.handlers:
        return

    root_logger = logging.getLogger()
    if root_logger.handlers:
        return

    handler = logging.StreamHandler()
    handler.setLevel(logging.DEBUG)
    handler.setFormatter(logging.Formatter("[%(name)s] %(levelname)s %(message)s"))
    LOGGER.addHandler(handler)
    LOGGER.propagate = False
