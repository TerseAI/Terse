---
name: terse-self-host
description: Self-host the Terse control plane. Use when the user wants to run Terse on their own infrastructure instead of Terse Cloud, or mentions self-hosting Terse, running the backend themselves, on-prem, or npx create-terse. Boots the full platform (backend, frontend, Postgres) in Docker.
license: MIT
compatibility: Requires Docker with Compose v2 and Node 20+
metadata:
  author: Terse AI
  version: "0.2.1"
  category: setup
---

# Self-host the Terse control plane

Boot a full local copy of the Terse control plane (backend + frontend + Postgres) inside Docker via `npx create-terse`. This installs the platform itself; it is not the same as building a workflow. If the user actually wants to build a workflow on Terse Cloud, hand off to the `terse-create` skill instead.

The `create-terse` stack does not include the durable actor control plane. If the user's workflow requires `Actor` subclasses from `terse-sdk`, explain that durable actors currently require Terse Cloud; do not suggest an internal environment-variable workaround.

## Prefer computer use when available

Use computer-use tools whenever the environment exposes them and the task can be completed reliably through a graphical interface. This includes browser and desktop surfaces in apps such as Claude Code, ChatGPT, and other installed or signed-in applications.

- Before any computer-use call, obtain explicit permission, including for read-only inspection. Generate the request from the immediate next action; name the actual app or site, the exact UI action, and the task outcome. Ask and wait: "I notice computer use is available. Would you like me to use it to [action] in [app/site] so I can [outcome]?" Never reuse a generic dashboard example when it does not match the task.
- For API-key setup, say which provider's API-key page you want to open and whether you intend to navigate, create a scoped key, or verify configuration; explain that the user retains control when the secret is shown or copied. For an authorization window opened by `terse integrate connect`, say which integration is being connected and ask to review and continue that specific consent flow, handing control back for sign-in or MFA.
- Treat an explicit request to use computer use for the current task as permission for that stated scope; do not ask redundantly. Otherwise, availability alone is never consent.
- Once approved, proceed with routine in-scope navigation, inspection, screenshots, verification, clicking, typing, and uploading without asking for every step. Ask again before expanding to another app, account, surface, or materially different goal.
- If the user declines or does not answer, do not use computer use. Continue with native tools when possible, or explain the smallest manual step needed.
- Ask immediately before any consequential external action the user has not already explicitly authorized: sending or publishing, submitting a consequential form, deleting, purchasing, changing permissions or security settings, or modifying production data. A clear request to perform that specific action is approval for its ordinary in-scope UI steps; do not ask again for every click.
- Begin an OAuth connection only when the user explicitly asks to connect that integration. Navigate the consent flow when authorized, but hand control to the user for passwords, MFA codes, payment details, or other sensitive fields; never read, reveal, or enter them through computer use.
- Stay within the requested surface and avoid opening unrelated private content. After an action, inspect the resulting screen and report what actually happened.
- Keep source-code edits, exact structured reads, bulk or repeatable operations, and Terse CLI commands in their native tools. Use a dedicated connector or API when the UI cannot perform the task reliably or safely.
- Fall back gracefully when computer use is unavailable, the app is not installed or signed in, the surface cannot be controlled, or the UI would expose secrets or increase risk. Explain the smallest manual step the user must take, then continue automatically.
- Preserve every confirmation and testing-safety rule below. Computer use changes the interaction surface, not the permission boundary.

**Read [references/self-hosting.md](references/self-hosting.md) now and follow it end to end.** It carries the full `npx create-terse` flow: prerequisite checks, interactive vs non-interactive runs, error recovery, post-bootstrap integration setup (the OAuth env-var table), and the production-exposure caveats to surface before the instance leaves `localhost`.

## Reference docs

For anything the bundled reference doesn't cover, pull the live docs:

- Doc index: https://docs.useterse.ai/llms.txt
- Hosting overview: https://docs.useterse.ai/hosting — control plane vs data plane, and the three deployment options.
- Self-hosting the control plane: https://docs.useterse.ai/self-hosting-control-plane — for `npx create-terse`.
- Self-hosting the data plane (Hybrid): https://docs.useterse.ai/self-hosting — for `terse attach` against your own runtime.
