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

This is **not** the same as scaffolding a job. It boots a full local copy of the Terse control plane (backend + frontend + Postgres) inside Docker.

### B1. Verify prerequisites

Don't run a long preflight, but quickly check the two things that *will* break the bootstrap if missing:

- `docker --version` and `docker compose version` (must be Compose v2 — `docker-compose` v1 will not work).
- `node --version` (Node 20+).

If Docker is missing or daemon isn't running, stop and ask the user to install / start Docker Desktop before re-running.

### B2. Run `npx create-terse`

```bash
npx create-terse
```

The script is interactive (uses `@clack/prompts`). It will ask for:

1. **Target directory** (default `./terse`). This becomes the operational root for the install — `docker-compose.yml`, `.env`, and a `README.md` all land here.
2. **Frontend URL** (default `http://localhost:5173`).
3. **Backend URL** (default `http://localhost:3001`).

Then it does, in order:

1. Picks a free Postgres host port (5432 → 54322 → 54323 …).
2. Writes `.env` with: `FRONTEND_URL`, `BACKEND_URL`, `POSTGRES_USER/PASSWORD/DB/PORT`, `JWT_SECRET` (generated), `LOCAL_SECRETS_ENCRYPTION_KEY` (generated), `VITE_API_BASE_URL`, `VITE_BACKEND_REDIRECT_URL`, `VITE_SOCKET_URL`, `NODE_ENV=development`, commented `TERSE_IMAGE=`.
3. `docker compose pull` (first run downloads ~500MB) → `docker compose up -d`. Backend container runs Prisma migrations for both schemas on startup, then `pnpm run dev:server`.
4. Polls the backend URL until it answers (up to 120s).
5. `npm install -g terse-cli` if `terse` isn't on PATH.
6. `terse target use --backend-url … --frontend-url … --yes` — writes a managed export block to `~/.zshrc` or `~/.bashrc`.

Set the Bash timeout to 600000 (10 minutes). The image pull is the slow step.

### B3. React to errors

- **`docker: command not found`** or **`Cannot connect to the Docker daemon`**: tell the user to install / start Docker Desktop, then re-run.
- **`port is already allocated`**: another service is on the chosen frontend or backend port. Have the user re-run and pick different URLs (with non-default ports), or stop the conflicting service.
- **Backend wait times out (`Backend at … never started responding`)**: run `docker compose logs backend` from the target directory and surface the error. Most common cause is migrations failing — usually a stale `terse_postgres` volume from a previous version. `docker compose down -v && docker compose up -d` clears it (destroys data).
- **Image pull fails**: the prebuilt image lives at `us-central1-docker.pkg.dev/fluid-analogy-473415-c2/public/terse:latest`. If the user is on a restricted network, they may need to allowlist that host or set `TERSE_IMAGE=` in `.env` to point at a mirror.

### B4. Hand off

When the script finishes the stack is **already running**. Do not run `pnpm dev` or any other start command — the doc warning here is critical: an old version of the docs told users to run `pnpm dev`, which does not apply.

Tell the user, in this order:

1. **Open the frontend URL** they confirmed. The first request bootstraps a single admin identity (`<whoami>@localhost`, where `whoami` is the backend container's user) and signs them in. There is **no signup form** — local auth is hard single-user by design.
2. **Reload their shell** before the next `terse …` command: `source ~/.zshrc` or open a new terminal. The CLI target was exported via the shell rc and only takes effect in new shells. Verify with `terse target` — expect `Target: local` with `(TERSE_BACKEND_URL)` annotation.
3. From a new shell, `terse init <job-name>` scaffolds the user's first job against the local instance.
4. Daily ops live in `<target-dir>/README.md` (logs, upgrade, backup, stop).

### B5. Critical caveats to surface

If the user looks like they're going to expose the instance off `localhost`, warn them — these are not negotiable:

- **No authentication wall.** First request to the backend becomes admin. Put the install behind your own auth (Tailscale, Cloudflare Access, an authenticated reverse proxy) before anyone else can reach it.
- **Set `NODE_ENV=production` in `.env`** and restart with `docker compose up -d` before exposing, so session cookies are marked `secure`.
- **Back up `LOCAL_SECRETS_ENCRYPTION_KEY`** out of band. If it's lost, every encrypted integration credential is unrecoverable.
- **Job code is not sandboxed.** `LocalSandboxService` runs job subprocesses inside the backend container — they share the backend's env vars (including API keys), filesystem, and network. Set `MODAL_TOKEN_ID` + `MODAL_TOKEN_SECRET` in `.env` and restart to opt into per-run isolated sandboxes.
- **No multi-user.** For real multi-user auth, set the `WORKOS_*` env vars and restart.

For long-lived production-grade self-host installs, point the user at https://docs.useterse.ai/self-hosting-control-plane for the full guide.
