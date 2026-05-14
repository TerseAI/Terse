# Contributing to Terse

Thank you for your interest in contributing to Terse!

Terse aims to power the next generation of workflow builders as code.
We'd love to collaborate with you to make this vision a reality.

## License

TensorZero is licensed under the [Sustainable Use License](LICENSE).
By contributing to this repository, you agree to license your contributions under the same license.

## Community & Support

### Slack and Discord

Join our community on [Slack](https://www.tensorzero.com/slack)

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
Share your content in our community channels (Slack and Discord), tag us on social media, or reach out if you'd like technical review or feedback before publishing.

We're happy to provide guidance and support for both types of content to help you create high-quality resources for the Terse community.

### Integrations

We're open to exploring integrations with other projects and tools (both open-source and commercial).
Reach out if you're interested in collaborating.

### Security

If you discover a security vulnerability, please email us at [security@useterse.ai](mailto:security@useterse.ai).

### Other

Did you have something else in mind? Reach out on Slack and let us know.

---

## Technical Guide

### Repository layout

Terse is a pnpm monorepo. The workspaces you'll touch most often:

| Path | What it is |
| --- | --- |
| `backend/` | Node/Express + Prisma server. Hosts the API, socket.io, run executor, and cron callbacks. |
| `frontend/` | React + Vite app. The Terse dashboard. |
| `terse-types/` | Shared types, enums, and helpers consumed by every other package. |
| `packages/terse-sdk/` | The TypeScript SDK developers use to author workflows. |
| `packages/terse-cli/` | The `terse` CLI (`terse init`, `terse generate`, `terse deploy`). |
| `packages/terse-claude-plugin/` | Claude Code skill that wraps the SDK. |
| `docs/` | Mintlify documentation site. |

### Prerequisites

- **Node.js 20+** (the backend and Vite both target modern Node).
- **pnpm 9+** — install with `npm install -g pnpm` or `corepack enable`.
- **PostgreSQL 14+** running locally, with a database named `terse` reachable at `postgres://postgres@localhost/terse`. Adjust `DATABASE_URL` in `backend/.env` if your setup differs.

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

   - `JWT_SECRET` — any random string for local dev.
   - `DATABASE_URL` — your local Postgres URL.
   - `WORKOS_CLIENT_ID`, `WORKOS_API_KEY`, `WORKOS_COOKIE_PASSWORD` (32+ chars), `WORKOS_REDIRECT_URI` — required for auth. Grab keys from the [WorkOS dashboard](https://dashboard.workos.com).
   - `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` — required to run workflows that use those providers.

   Everything else is optional and falls back to sensible defaults — see `backend/src/config/settings.ts` for the source of truth. The frontend `.env` defaults work as-is for local dev.

3. **Set up the database.**

   ```bash
   cd backend
   pnpm run db:generate   # generate the Prisma client
   pnpm run db:push       # apply the schema to your local Postgres
   cd ..
   ```

   You can inspect the database any time with `pnpm --filter backend run db:studio`.

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

### Submitting a PR

1. Branch from `main`.
2. Run `pnpm run format` and `pnpm run build` before pushing — CI runs the same.
3. Open a PR against `main` with a short description of what changed and why. Link any related issue or discussion.

If you get stuck on setup, ping us in [Slack](https://www.tensorzero.com/slack) or open a GitHub Discussion — we'd rather unblock you early than have you fight the toolchain.
