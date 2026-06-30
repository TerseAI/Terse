---
name: init
description: Set up Terse from scratch. Handles two distinct flows — scaffold a new SDK job against Terse Cloud (`terse init`), or self-host the entire Terse control plane (`npx create-terse`). Picks the right one based on user intent.
argument-hint: [project-name]
---

# Initialize Terse

Get the user fully set up on Terse. Optional argument: **$ARGUMENTS** (project directory name).

There are **two different setups** and the user can mean either. Disambiguate before running anything.

| Intent the user expressed                                                                | Run this                | What it produces                                            |
| ---------------------------------------------------------------------------------------- | ----------------------- | ----------------------------------------------------------- |
| "Set up Terse", "get started", "scaffold a project", "I want to build a job"             | `terse init`            | A new SDK project pointed at **Terse Cloud** (managed).     |
| "Self-host Terse", "run Terse locally", "run the control plane myself", "install the platform" | `npx create-terse`      | A Docker-based deployment of the **Terse control plane** on the user's machine. |

If the request is ambiguous, default to `terse init` (managed) — that's what 95% of new users want — and tell the user how to switch tracks if they actually meant self-hosting.

## Reference docs

For anything beyond a vanilla setup, pull the live docs:

- Doc index: https://docs.useterse.ai/llms.txt
- CLI reference: https://docs.useterse.ai/reference/cli, the authoritative source for `terse init`, `terse auth login`, `terse integrate`, and friends.
- Hosting overview: https://docs.useterse.ai/hosting — control plane vs data plane, and the three deployment options.
- Self-hosting the control plane: https://docs.useterse.ai/self-hosting-control-plane — for `npx create-terse`.
- Self-hosting the data plane (Hybrid): https://docs.useterse.ai/self-hosting — for `terse attach` against your own runtime.

---

## Track A — Scaffold an SDK project (`terse init`)

This is the default path. The user wants to build a job; Terse Cloud will host the control plane and the data plane.

### A1. Run `terse init`

Don't preflight. Don't run `find`, `ls`, `terse --version`, or `terse integrate list` to "check the environment" before doing anything. Just run `terse init` and react to whatever it tells you. The CLI already knows how to detect existing projects, missing auth, taken directory names, and a missing `package.json`. Trust its error messages and recover from them.

```bash
terse init <project-name>   # scaffold into a new subdirectory
terse init                  # scaffold into the current directory (must be empty of npm files)
```

Use the project name from `$ARGUMENTS` if provided, otherwise scaffold into the current directory.

Set the Bash timeout to 600000 (10 minutes). Dependency install and browser-side auth can both take a while.

`terse init` handles auth itself: if the user is not logged in, it opens the browser to WorkOS and waits for them to authorize. Tell the user a browser tab may pop up. The single command scaffolds files, installs dependencies, logs in if needed, creates the remote Terse project, writes `terse.config.json`, and runs `terse generate`.

### A2. React to errors

If `terse init` fails, read the error and recover:

- **`command not found: terse`**: install the CLI with `npm i -g terse-cli` (or `pnpm add -g terse-cli` / `yarn global add terse-cli` if the user prefers), then retry `terse init`.
- **`Detected an existing npm project in this directory`**: the directory has a `package.json`. If it also has a `terse.config.json` or `src/terse.generated.ts`, the user is already set up: stop, do not re-init, and offer `/terse:create` for adding a job. If it is some other npm project, recommend `terse attach` (adds Terse to an existing project) or rerun with a project name to scaffold a sibling directory.
- **`Directory "X" already exists`**: pick a different project name, or have the user `cd` into the existing directory so you can evaluate from there.
- **`ACTION REQUIRED: Not authenticated`**: only happens in non-interactive / CI mode when no valid stored credentials are present. Run `terse auth login` via Bash with a 10-minute timeout, then retry `terse init`.
- **`Failed to create Terse project`**: the API key is valid but the remote create failed. The local scaffold still exists. Surface the error to the user and suggest retrying after fixing connectivity, or creating the project from the dashboard and writing `terse.config.json` manually.

### A3. Hand off

The CLI prints a "Next steps" block at the end of a successful `terse init`. Don't repeat it verbatim. Just remind the user of the one or two things they said they wanted to do, in this order of likelihood:

1. Connect more integrations: `terse integrate connect <type>`.
2. Use `/terse:create <description>` to scaffold their first job.
3. Run `terse deploy` once a job is written.

---

## Track B — Self-host the control plane (`npx create-terse`)

Use this when the user explicitly wants to run the Terse platform on their own machine. Signals: "self-host", "run the backend myself", "I don't want to use Terse Cloud", "install Terse on my server", "on-prem".

This boots a full local copy of the Terse control plane (backend + frontend + Postgres) inside Docker. It is **not** the same as scaffolding a job.

**Read [reference/self-hosting.md](reference/self-hosting.md) now and follow it end to end.** It carries the full `npx create-terse` flow: prerequisite checks, interactive vs non-interactive runs, error recovery, post-bootstrap integration setup (the OAuth env-var table), and the production-exposure caveats to surface before the instance leaves `localhost`.
