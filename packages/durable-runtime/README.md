# `@terse/durable`

An embeddable durable execution runtime for TypeScript.

This package is being developed contract-first inside the Terse monorepo. It will own the small set of durability primitives Terse needs while remaining independent of Terse's backend, SDK, sandbox provider, and compiler.

## Scope

- Append-only, versioned journals
- Deterministic replay at explicit operation boundaries
- Durable steps with automatic retries
- Durable timers
- Typed hooks that suspend and resume execution
- Atomic writes, execution fencing, and divergence detection
- Test utilities for deterministic clocks, IDs, storage, and failure injection

## Non-goals

- Running a queue, scheduler, server, or worker fleet
- Bundling or evaluating user code in a separate VM
- Owning sandbox lifecycle or external event delivery
- Providing exactly-once execution of external side effects

The package is intentionally private while its public contract is being designed. It can move to its own repository and adopt an independent release lifecycle once that contract is stable.
