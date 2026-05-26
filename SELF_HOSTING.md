# Self-hosting Terse

Run Terse on your own machine. Designed for a single operator — you — to use Terse without going through the hosted service.

Self-host gives you the full Terse app (agents, integrations, runs, SDK jobs) backed by your own Postgres database and a local SQLite file for auth. No WorkOS account needed, no Modal account needed.

## Quick start

> Once `npx create-terse` is published, this will be a one-line install. Until then, the manual steps below get you running.

```bash
git clone https://github.com/TerseAI/Terse.git my-terse
cd my-terse
pnpm install
cp backend/.env.example backend/.env   # then fill in the required vars (below)
pnpm --filter terse-types build
cd backend
pnpm db:generate
pnpm prisma migrate deploy
pnpm db:migrate:local-auth
cd ..
pnpm dev
```

Open <http://localhost:3000>. The first request bootstraps your OS user as the single admin — no login form, no email setup.

## Required configuration

The bare minimum to boot:

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Postgres connection string. Bring your own Postgres (local install, Docker, hosted). |
| `JWT_SECRET` | Any sufficiently long random string. Used for internal token signing. |
| `LOCAL_AUTH_DB_URL` | SQLite path for auth tables. Defaults to `file:./prisma/local-auth/local-auth.db`. |
| `FRONTEND_URL`, `BACKEND_URL` | Default to `http://localhost:3000` / `http://localhost:8080`. |
| `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `TAVILY_API_KEY` | Model provider + web-search keys for agents to actually run. |

Anything else (Slack, GitHub, Gmail, Linear, Attio, Notion, Resend email, Modal, WorkOS, Posthog telemetry) is opt-in — leave the env vars unset and those integrations register as unavailable.

See `backend/.env.example` for the full list.

## What's included

- **Authentication** — Local single-user auth. First request creates your OS user as admin.
- **Organizations** — Single-org mode. One org per self-host install.
- **Agents and runs** — Full agent builder, run history, trigger management.
- **Integrations** — Slack, GitHub, Gmail, Linear, Attio, Notion (any subset, opt-in by env var).
- **SDK jobs** — User-written job code runs **in-process** in the backend. `terse deploy` works against your local install.

## What's NOT included in self-host

- **Modal sandbox isolation for SDK jobs.** Jobs run in the backend's own Node process.
- **Hosted email delivery.** Set `RESEND_API_KEY` to enable, or accept that email notifications are no-ops.
- **Weekly agent reviews via Claude Code.** Requires containerized sandbox; auto-skipped in self-host mode.
- **WorkOS-based multi-tenant auth.** Single user, single org by design.

## SDK jobs

Self-host runs your `terse deploy`'d jobs by importing your built package as a Node module and invoking the handler directly. No container, no image build, no Modal account.

Set `LOCAL_SDK_PACKAGE_PATH` (or use the default) to point at your built SDK project. The backend's sandbox provider auto-loads the package on first job invocation.

This means:

- **Fast.** Job runs have no cold start.
- **No isolation.** See [Security model](#security-model) below.
- **Hot reload caveat.** If you edit your job code while the backend is running, you may need to restart for changes to take effect (depends on tsx's transform cache).

## Security model

Self-host is designed for **a single operator running on a machine they own**. It is not a multi-tenant deployment platform.

### What is and isn't isolated

- SDK job code runs in the **same Node process** as the backend. There is no process isolation, no container, no sandbox.
- A job can read the backend's environment variables (including API keys), the filesystem, and the network.
- A crash or infinite loop in job code takes down the backend.

This is defensible because:

- You wrote the job code.
- You chose where to run the install.
- You are the only user.

### When NOT to use self-host

- **Don't expose your install to a public IP** without an authenticated reverse proxy in front.
- **Don't run SDK jobs you didn't author or audit.**
- **Don't share an install across multiple tenants** — there's no isolation between them.

### Hardening recommendations

If you have to expose your self-host beyond `localhost`:

1. Put it behind a reverse proxy with its own authentication (Cloudflare Access, Tailscale Funnel + ACLs, basic auth, etc.).
2. Restrict outbound network from the host running Terse (your job code can reach the internet otherwise).
3. Run on a dedicated machine or VM, not on your personal workstation if you store sensitive credentials there.
4. Use Terse cloud if you need real multi-tenant isolation — that's what it's for.

## Updating

```bash
cd my-terse
git pull
pnpm install
cd backend
pnpm db:generate
pnpm prisma migrate deploy
pnpm db:migrate:local-auth
cd ..
pnpm dev
```

## Reporting issues

- **Self-host bugs, setup issues**: open an issue at <https://github.com/TerseAI/Terse/issues>.
- **Security vulnerabilities**: see [SECURITY.md](./SECURITY.md) — email security@useterse.ai.
