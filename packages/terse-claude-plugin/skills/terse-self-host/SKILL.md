---
name: terse-self-host
description: Self-host the Terse control plane. Use when the user wants to run Terse on their own infrastructure instead of Terse Cloud, or mentions self-hosting Terse, running the backend themselves, on-prem, or npx create-terse. Boots the full platform (backend, frontend, Postgres) in Docker.
license: MIT
compatibility: Requires Docker with Compose v2 and Node 20+
metadata:
  author: Terse AI
  version: "0.2.0"
  category: setup
---

# Self-host the Terse control plane

Boot a full local copy of the Terse control plane (backend + frontend + Postgres) inside Docker via `npx create-terse`. This installs the platform itself; it is not the same as building a workflow. If the user actually wants to build a workflow on Terse Cloud, hand off to the `terse-create` skill instead.

**Read [references/self-hosting.md](references/self-hosting.md) now and follow it end to end.** It carries the full `npx create-terse` flow: prerequisite checks, interactive vs non-interactive runs, error recovery, post-bootstrap integration setup (the OAuth env-var table), and the production-exposure caveats to surface before the instance leaves `localhost`.

## Reference docs

For anything the bundled reference doesn't cover, pull the live docs:

- Doc index: https://docs.useterse.ai/llms.txt
- Hosting overview: https://docs.useterse.ai/hosting — control plane vs data plane, and the three deployment options.
- Self-hosting the control plane: https://docs.useterse.ai/self-hosting-control-plane — for `npx create-terse`.
- Self-hosting the data plane (Hybrid): https://docs.useterse.ai/self-hosting — for `terse attach` against your own runtime.
