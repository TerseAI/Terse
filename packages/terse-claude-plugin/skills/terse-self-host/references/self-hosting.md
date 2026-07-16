# Self-host the Terse control plane (`npx create-terse`)

Boots a full local copy of the Terse control plane (backend + frontend + Postgres) inside Docker. This is not the same as scaffolding a job (`terse init`); it installs the platform itself.

## 1. Verify prerequisites

Don't run a long preflight, but quickly check the two things that *will* break the bootstrap if missing:

- `docker --version` and `docker compose version` (must be Compose v2 — `docker-compose` v1 will not work).
- `node --version` (Node 20+).

If Docker is missing or daemon isn't running, stop and ask the user to install / start Docker Desktop before re-running.

## 2. Run `npx create-terse`

```bash
npx create-terse                         # interactive
npx create-terse -y                      # non-interactive, accept all defaults
npx create-terse -y --target ./my-terse --backend-url http://localhost:3001 --frontend-url http://localhost:5173
```

The script is interactive by default (uses `@clack/prompts`). It will ask for:

1. **Target directory** (default `./terse`). This becomes the operational root for the install — `docker-compose.yml`, `.env`, and a `README.md` all land here.
2. **Frontend URL** (default `http://localhost:5173`).
3. **Backend URL** (default `http://localhost:3001`).

**Non-interactive mode** (required when running from a Claude Code agent, CI, or any non-TTY environment): pass `-y` / `--non-interactive`. The script also auto-enables this mode when stdin or stdout is not a TTY, so it will not hang inside an agent. Override individual defaults with `--target <dir>`, `--frontend-url <url>`, and `--backend-url <url>`.

Then it does, in order:

1. Picks a free Postgres host port (5432 → 54322 → 54323 …).
2. Writes `.env` with: `FRONTEND_URL`, `BACKEND_URL`, `POSTGRES_USER/PASSWORD/DB/PORT`, `JWT_SECRET` (generated), `LOCAL_SECRETS_ENCRYPTION_KEY` (generated), `VITE_API_BASE_URL`, `VITE_BACKEND_REDIRECT_URL`, `VITE_SOCKET_URL`, `NODE_ENV=development`, commented `TERSE_IMAGE=`.
3. `docker compose pull` (first run downloads ~500MB) → `docker compose up -d`. Backend container runs Prisma migrations for both schemas on startup, then `pnpm run dev:server`.
4. Polls the backend URL until it answers (up to 120s).
5. `npm install -g terse-cli` if `terse` isn't on PATH.
6. `terse target use --backend-url … --frontend-url … --yes` — writes a managed export block to `~/.zshrc` or `~/.bashrc`.

Set the Bash timeout to 600000 (10 minutes). The image pull is the slow step.

## 3. React to errors

- **`docker: command not found`** or **`Cannot connect to the Docker daemon`**: tell the user to install / start Docker Desktop, then re-run.
- **`port is already allocated`**: another service is on the chosen frontend or backend port. Have the user re-run and pick different URLs (with non-default ports), or stop the conflicting service.
- **Backend wait times out (`Backend at … never started responding`)**: run `docker compose logs backend` from the target directory and surface the error. Most common cause is migrations failing — usually a stale `terse_postgres` volume from a previous version. `docker compose down -v && docker compose up -d` clears it (destroys data).
- **Image pull fails**: the prebuilt image lives at `us-central1-docker.pkg.dev/fluid-analogy-473415-c2/public/terse:latest`. If the user is on a restricted network, they may need to allowlist that host or set `TERSE_IMAGE=` in `.env` to point at a mirror.

## 4. Hand off

When the script finishes the stack is **already running**. Do not run `pnpm dev` or any other start command — the doc warning here is critical: an old version of the docs told users to run `pnpm dev`, which does not apply.

Tell the user, in this order:

1. **Open the frontend URL** they confirmed. The first request bootstraps a single admin identity (`<whoami>@localhost`, where `whoami` is the backend container's user) and signs them in. There is **no signup form** — local auth is hard single-user by design.
2. **Reload their shell** before the next `terse …` command: `source ~/.zshrc` or open a new terminal. The CLI target was exported via the shell rc and only takes effect in new shells. Verify with `terse target` — expect `Target: local` with `(TERSE_BACKEND_URL)` annotation.
3. From a new shell, `terse init <job-name>` scaffolds the user's first job against the local instance.
4. Daily ops live in `<target-dir>/README.md` (logs, upgrade, backup, stop).

## 5. Enabling integrations after bootstrap

A self-hosted instance has **one** config file: `<target-dir>/.env`. There is no per-integration config, no second admin panel, no separate secrets file. When the user says "Gmail isn't showing up in the dashboard" or "how do I connect GitHub" on a self-host install, the workflow is always the same shape:

1. Add the OAuth env vars to `<target-dir>/.env` (the same `.env` `create-terse` wrote).
2. From that directory, `docker compose up -d`. Compose re-reads `.env` and restarts the containers that need it (usually backend + frontend; Postgres is untouched).
3. Reload the dashboard. The integration now appears in the connect list.

Do not `grep` the backend source to "find which vars unlock it" — the table below is canonical. The gate is in `backend/src/settings.ts` (`optionalIntegrationSettings(...)`): every listed env var must be set and non-empty, otherwise the integration is hidden from the UI entirely.

**API-key integrations** require **no env vars** — Datadog, Snowflake, HeyReach, LaunchDarkly, PostHog, WorkOS (as an integration, distinct from WorkOS for login), and the cron-job integration all work out of the box. The user pastes their API key in the dashboard at connect time.

**OAuth integrations** — every required var must be set, or the integration is hidden:

| Integration | Required | Optional |
|---|---|---|
| Gmail | `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REDIRECT_URI`, `GMAIL_FRONTEND_REDIRECT`, `GMAIL_PUBSUB_TOPIC` | `GMAIL_PUBSUB_AUDIENCE`, `GMAIL_PUBSUB_SERVICE_ACCOUNT_EMAIL` |
| GitHub | `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_APP_CALLBACK_URL`, `GITHUB_APP_NAME` | `GITHUB_LOGIN_CALLBACK_URL`, `GITHUB_LOGIN_REDIRECT` |
| Slack | `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_OAUTH_CALLBACK_URL` | `SLACK_SIGNING_SECRET` |
| Linear | `LINEAR_CLIENT_ID`, `LINEAR_CLIENT_SECRET_ID`, `LINEAR_OAUTH_CALLBACK_URL`, `LINEAR_WEBHOOK_SIGNING_SECRET` | — |
| Notion | `NOTION_OAUTH_CLIENT_ID`, `NOTION_OAUTH_CLIENT_SECRET`, `NOTION_OAUTH_REDIRECT_URI` | — |
| Attio | `ATTIO_CLIENT_ID`, `ATTIO_CLIENT_SECRET`, `ATTIO_REDIRECT_URI` | — |
| Meta Ads | `META_ADS_CLIENT_ID`, `META_ADS_CLIENT_SECRET`, `META_ADS_REDIRECT_URI` | — |
| Web monitors (Parallel) | `PARALLEL_API_KEY`, `PARALLEL_WEBHOOK_SECRET` | — |


Callbacks and redirects must be reachable from the user's browser. For a default local install:

- `*_REDIRECT_URI` / `*_CALLBACK_URL` → `http://localhost:3001/<provider>/callback` (or wherever `BACKEND_URL` lives)
- `*_FRONTEND_REDIRECT` → `http://localhost:5173/` (or wherever `FRONTEND_URL` lives)

If the OAuth provider rejects `localhost` (Google does for some scopes, Slack does for distributed apps), the user needs a public tunnel (ngrok, Cloudflare Tunnel). Point the callback URLs at the tunnel hostname, register that hostname with the provider, leave everything else alone.

## 6. Critical caveats to surface

If the user looks like they're going to expose the instance off `localhost`, warn them — these are not negotiable:

- **No authentication wall.** First request to the backend becomes admin. Put the install behind your own auth (Tailscale, Cloudflare Access, an authenticated reverse proxy) before anyone else can reach it.
- **Set `NODE_ENV=production` in `.env`** and restart with `docker compose up -d` before exposing, so session cookies are marked `secure`.
- **Back up `LOCAL_SECRETS_ENCRYPTION_KEY`** out of band. If it's lost, every encrypted integration credential is unrecoverable.
- **Job code is not sandboxed.** `LocalSandboxService` runs job subprocesses inside the backend container — they share the backend's env vars (including API keys), filesystem, and network. Set `MODAL_TOKEN_ID` + `MODAL_TOKEN_SECRET` in `.env` and restart to opt into per-run isolated sandboxes.
- **No multi-user.** For real multi-user auth, set the `WORKOS_*` env vars and restart.

For long-lived production-grade self-host installs, point the user at https://docs.useterse.ai/self-hosting-control-plane for the full guide.
