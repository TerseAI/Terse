# Terse AI - Agent Instructions

See `CURSOR.md` for full code style, architecture, and contribution guidelines.

## Cursor Cloud specific instructions

### Services overview

| Service | How to run | Port |
|---------|-----------|------|
| Backend (Express.js) | `cd backend && pnpm run dev:server` | 3001 |
| Frontend (Vite + React) | `cd frontend && pnpm run dev` | 5173 |
| PostgreSQL | `sudo pg_ctlcluster 16 main start` | 5432 |

### Prerequisites before running dev servers

1. **PostgreSQL must be running** — `sudo pg_ctlcluster 16 main start`
2. **Shared packages must be built first** — `pnpm run dev:setup` from repo root (builds `terse-types`, `terse-sdk`, `terse-cli`)
3. **Prisma client must be generated** — handled by the backend's `predev` hook (`pnpm run db:generate`)

### Database

- Local PostgreSQL with pgvector extension. Connection string uses `postgres://ubuntu:ubuntu@localhost/terse`.
- Run migrations: `cd backend && DATABASE_URL="postgres://ubuntu:ubuntu@localhost/terse" pnpm exec prisma migrate dev`
- The backend `dev:server` script reads `.env` in `/workspace/backend/`. Override `DATABASE_URL` via env var if the `.env` gets stale.

### Backend dev gotchas

- `pnpm run dev` (the full dev script) tries to use ngrok for tunnel mode. For local dev without tunnels, use `pnpm run dev:server` directly.
- The backend binds to port 3001 (`PORT=3001` in `.env`). The `.env.example` defaults to 8080 — update it.
- WorkOS, OpenAI, Anthropic, and other external API keys are required for full functionality but NOT for starting the server. The server boots without them (settings are loaded lazily).
- Redis is optional; Socket.IO falls back to in-memory adapter when `REDIS_URL` is unset.
- **Environment variable precedence**: `dotenv` does NOT override existing shell env vars. If secrets like `WORKOS_COOKIE_PASSWORD` or `DATABASE_URL` are injected via environment, the `.env` file values are ignored. Always use the env var values when generating tokens or sealed sessions programmatically.

### Frontend

- Vite dev server proxies `/api` requests to `http://localhost:3001` (configured in `vite.config.ts`).
- The frontend `.env` works as-is from `.env.example` for local dev.
- The app redirects to WorkOS login on load. Without valid WorkOS credentials, you'll see the login page but cannot proceed past it.

### Lint / format / test commands

- `pnpm run format:check` — checks Prettier formatting across all packages
- `cd frontend && pnpm run lint` — ESLint (has pre-existing warnings/errors in codebase)
- `cd frontend && pnpm run build` — TypeScript type-check + Vite production build
- `cd backend && pnpm run build` — TypeScript compilation
- `pnpm run python:check` — ruff lint + format check + ty type-check + pytest (Python SDK)
- `pnpm run python:test` — pytest only

### Python SDK

- Uses `uv` for dependency management (`uv sync --all-packages` from repo root).
- Virtual environment at `/workspace/.venv`.
- Tests: `pnpm run python:test` or `./.venv/bin/pytest packages/terse-python-sdk/tests`.
