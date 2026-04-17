"""Job-scoped context propagation.

Mirrors the TypeScript SDK's ``AsyncLocalStorage``-based job context
(``packages/terse-sdk/src/context.ts``) using :mod:`contextvars`, which is
the Python-native primitive for implicit per-call context propagation:

* Each thread has its own top-level :class:`~contextvars.Context`, so values
  are naturally isolated between concurrent requests in threaded WSGI/ASGI
  servers.
* ``asyncio`` copies the current context into every spawned task, so the
  context propagates across ``await`` boundaries without manual plumbing.

The context is set by :meth:`terse_sdk.runtime.Terse.handle_trigger` for the
duration of a job handler so that any :class:`~terse_sdk.runtime.TerseAgent`
constructed inside picks up the active ``session_id``, ``run_id``, and
``api_base_url`` automatically.
"""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass

__all__ = [
    "TerseJobContext",
    "get_job_context",
    "job_context_scope",
]


@dataclass(frozen=True)
class TerseJobContext:
    """The ambient context available inside a running job handler."""

    session_id: str
    run_id: str
    api_base_url: str


_job_context_var: ContextVar[TerseJobContext | None] = ContextVar(
    "terse_job_context",
    default=None,
)


@contextmanager
def job_context_scope(ctx: TerseJobContext) -> Iterator[TerseJobContext]:
    """Activate ``ctx`` as the current job context for the ``with`` block."""

    token = _job_context_var.set(ctx)
    try:
        yield ctx
    finally:
        _job_context_var.reset(token)


def get_job_context() -> TerseJobContext | None:
    """Return the currently-active job context, or ``None`` outside a handler."""

    return _job_context_var.get()
