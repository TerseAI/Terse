# Contributing to Terse

Thank you for your interest in contributing to Terse!

Terse aims to power the next generation of workflow builders as code.
We'd love to collaborate with you to make this vision a reality.

## License

Terse is licensed under the [Sustainable Use License](LICENSE.md).
By contributing to this repository, you agree to license your contributions under the same license.

## Community & Support

### Slack

Join our community on [Slack](https://join.slack.com/t/tersecommunity/shared_invite/zt-3y01ap0bn-VvOqz~iJW0LbJ0cTqWuAIQ).

### GitHub

We use GitHub Issues to track bugs and feature requests.
For general questions, technical support, and conversations not directly related to code, please use GitHub Discussions.

## Contributions

> [!TIP]
>
> See the [`good-first-issue`](https://github.com/TerseAI/Terse/issues?q=is%3Aopen+is%3Aissue+label%3Agood-first-issue) label for simpler issues that might be a good starting point for new contributors.

### Code

For small changes (i.e. a few lines of code), feel free to open a PR directly.

For larger changes, please communicate with us first to avoid duplicate work or wasted effort.
You can start a discussion (GitHub or Slack) or open an issue as a starting point.
The team will be happy to provide feedback and guidance.

At this time, we don't assign issues to new external contributors (in the past, most people we assigned issues to never submitted a PR).
Please submit a PR directly once you're ready to start working on an issue.

> [!TIP]
>
> See the "Technical Guide" section below for more details on building and testing Terse.

### Documentation

The content for our documentation lives in the `docs/` directory.

For small changes (e.g. typos), feel free to open a PR directly.

For larger changes, please communicate with us first to avoid duplicate work or wasted effort.
You can start a discussion (GitHub or Slack) or open an issue as a starting point.

### Content — Examples, Tutorials, etc.

We'd love to collaborate on examples, tutorials, and other content that showcases how to build AI workflows with Terse.

For content contributed directly to our repository, please follow the same process as code contributions.

For external content (e.g. blog posts, videos, social media content), we're excited to support and amplify your work.
Share your content in our community Slack, tag us on social media, or reach out if you'd like technical review or feedback before publishing.

We're happy to provide guidance and support for both types of content to help you create high-quality resources for the Terse community.

### Integrations

We're open to exploring integrations with other projects and tools (both open-source and commercial).
Reach out if you're interested in collaborating.

### Security

Please don't open a public issue or PR for security vulnerabilities — see [SECURITY.md](SECURITY.md) for our private disclosure process.

### Other

Did you have something else in mind? Reach out on Slack and let us know.

---

## Technical Guide

### Prerequisites

- **Node.js 22+** (the backend and Vite both target modern Node).
- **pnpm 9+** — install with `npm install -g pnpm` or `corepack enable`.
- **PostgreSQL 14+** running locally, with a database named `terse` reachable at `postgres://postgres@localhost/terse`. Pick whichever install path matches your machine:

    - **macOS (Homebrew)** — `brew install postgresql@16 && brew services start postgresql@16 && createuser -s postgres && createdb -O postgres terse`. The `createuser -s postgres` step is load-bearing: Homebrew's `initdb` makes your OS user the bootstrap superuser, not `postgres`, so without it the default `DATABASE_URL` in `.env.example` fails with `role "postgres" does not exist`.
    - **macOS (GUI)** — [Postgres.app](https://postgresapp.com) ships with a `postgres` superuser already configured. Install it, click Start, then `createdb terse`.
    - **Linux (Debian/Ubuntu)** — `sudo apt install postgresql-16 && sudo -u postgres createdb terse`.

    Adjust `DATABASE_URL` in `backend/.env` if your setup differs.

### Setup

1. **Clone and install.**

   ```bash
   git clone https://github.com/TerseAI/Terse.git
   cd Terse
   pnpm install
   ```

2. **Configure environment variables.**

   ```bash
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env
   ```

   Open `backend/.env` and fill in the values you need. The minimum to boot the server is:

   - `JWT_SECRET` — any 16+ character random string. Generate one with `openssl rand -base64 32`.
   - `DATABASE_URL` — the default (`postgres://postgres@localhost/terse`) matches the Postgres install from Prerequisites. Adjust only if you went a different route.
   - `FRONTEND_URL` / `BACKEND_URL` — defaults are correct for local dev (`http://localhost:5173` / `http://localhost:3001`).
   - `LOCAL_DB_URL=file:./prisma/local/local.db` — **add this line manually**, it isn't in `.env.example` yet. The running server defaults this internally, but the Prisma CLI reads it from `.env` (see `backend/prisma/local/schema.prisma`), so the `db:push:local` step below fails without it.

   `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` are optional but recommended if you want to actually run workflows against those providers. Everything else is optional and falls back to sensible defaults; see `backend/src/settings.ts` for the source of truth. The frontend `.env` defaults work as-is for local dev.

   > **Heads up: auth in local dev.** Leave every `WORKOS_*` variable blank.
   > When the backend sees no WorkOS config, it boots into single-user local-auth
   > mode: the first request to the frontend bootstraps an admin user named
   > after your OS login (`whoami@localhost`) and you're signed in. No login
   > form, no signup, no WorkOS account required. If you accidentally fill in
   > a `WORKOS_*` variable, the backend switches to WorkOS SSO and your dev
   > login will break. That's the most common first-run failure.

3. **Set up the database.**

   ```bash
   cd backend
   pnpm run db:generate     # generate both Prisma clients (main + local)
   pnpm run db:push         # apply the main schema to your local Postgres
   pnpm run db:push:local   # apply the local-auth schema to SQLite (./prisma/local/local.db)
   cd ..
   ```

   Terse uses two Prisma clients: the main app schema (`backend/prisma/schema.prisma`, Postgres) and a local-only SQLite schema (`backend/prisma/local/schema.prisma`) that holds the singleton admin user and integration secrets used by local-auth mode. `db:generate` builds both clients; `db:push` applies the Postgres schema; `db:push:local` applies the SQLite schema. The `db:push:local` step is required: without it, the first request to the backend fails with `no such table: local_identities`. Inspect either with `pnpm --filter backend run db:studio`.

4. **Run the dev stack.**

   From the repo root:

   ```bash
   pnpm run dev
   ```

   This builds `terse-types`, `terse-sdk`, and `terse-cli` once, then starts every workspace in watch mode in parallel:

   - Backend at <http://localhost:3001>
   - Frontend at <http://localhost:5173>
   - SDK / CLI / types rebuild on save so downstream consumers pick up changes immediately.

5. **(Optional) Use your local CLI as `terse`.**

   ```bash
   pnpm run install-global
   ```

   This links your in-tree `packages/terse-cli` (and `terse-sdk`) as the global `terse` binary, so `terse init`, `terse generate`, and `terse deploy` in another project hit your local build.

### Common tasks

- **Run a single workspace.** `pnpm --filter backend run dev`, `pnpm --filter frontend run dev`, etc.
- **Build everything.** `pnpm run build`
- **Format / check formatting.** `pnpm run format` / `pnpm run format:check`
- **Backend tests.** `pnpm --filter backend run test`
- **Frontend lint.** `pnpm --filter frontend run lint`
- **Edit the Prisma schema.** Update `backend/prisma/schema.prisma`, then re-run `pnpm --filter backend run db:generate && pnpm --filter backend run db:push`.

### Test CLI/SDK changes in sandboxes

By default, Terse Cloud sandboxes install `terse-types`, `terse-sdk`, and `terse-cli` from npm. To test uncommitted changes to those packages in sandboxes without publishing, set these variables in `backend/.env` and restart the backend:

```bash
TERSE_DEV_LOCAL_PACKAGES=true
TERSE_LOCAL_PACKAGES_ROOT=/absolute/path/to/your/Terse/checkout
```

> [!WARNING]
> Local package hoisting is for local development only. Never set `TERSE_DEV_LOCAL_PACKAGES` in production.

Prerequisites:

- Run `pnpm run build` first — each package must have a `dist/` directory before the backend packs it.
- `TERSE_LOCAL_PACKAGES_ROOT` must point at the monorepo root (the directory that contains `terse-types/`, `packages/terse-sdk/`, and `packages/terse-cli/`).

When enabled, the backend `pnpm pack`s those three packages from your checkout and installs the resulting tarballs into sandbox dependency images instead of pulling from the registry. The dependency image hash includes a content hash of the packed tarballs, so image caches invalidate when your local builds change.

Confirm hoisting worked by triggering a sandbox run and checking the Activity log for:

```
[terse] running locally-hoisted packages: terse-types@…, terse-sdk@…, terse-cli@… (…)
```

With the env vars unset, sandboxes use registry packages as usual.

### Submitting a PR

1. Branch from `main`.
2. Run `pnpm run format` and `pnpm run build` before pushing — CI runs the same.
3. Open a PR against `main` with a short description of what changed and why. Link any related issue or discussion.

If you get stuck on setup, ping us in [Slack](https://join.slack.com/t/tersecommunity/shared_invite/zt-3y01ap0bn-VvOqz~iJW0LbJ0cTqWuAIQ) or open a GitHub Discussion — we'd rather unblock you early than have you fight the toolchain.
