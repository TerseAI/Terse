# Terse - The best Agent Builder For Software Teams

# Introduction

Terse is an Agent Builder build for the modern Software team. With the power of AI, writing code is no longer the bottleneck, it's all of the stuff around it. Code reviews, release notes, project statuses, tracking feedback etc...

Terse is a flexible platform that deeply integrates (can analyze video photo and text) with Linear Github Slack Notion PostHog Datadog etc... In minutes, you can build an background agent perfectly tailored to your workflow to help relieve these bottlenecks as they come up in your team.

## Package Manager

This project uses **pnpm** (not npm or yarn). Install it if you haven't:

```bash
npm install -g pnpm
```

Then install dependencies:

```bash
# In /frontend
pnpm install

# In /backend
pnpm install
```

## Python CLI and SDK Development

The repo now also contains a Python workspace for the in-progress Python CLI and Python SDK:

- `packages/terse-python-cli`
- `packages/terse-python-sdk`

These Python packages are managed with **uv** and use Astral tooling for linting and type checking.

### Prerequisites

Install uv if you do not already have it:

```bash
brew install uv
```

Make sure you have a Python interpreter that satisfies `>=3.11`. If you want uv to install one for you:

```bash
uv python install 3.11
```

### One-Time Python Workspace Setup

From the repo root:

```bash
npm run python:setup
```

This will:

- copy the repo-level TypeScript shared definitions into both Python packages
- regenerate the Python SDK Pydantic models from the TypeScript source of truth
- create `.venv/` at the repo root
- install the workspace packages in editable mode
- install shared dev tools like `ruff` and `ty`
- generate/update `uv.lock` when dependencies change

If you only want to refresh the mirrored shared types and generated Python models without syncing dependencies:

```bash
npm run python:refresh-types
```

### Manual CLI Runs

From the repo root, run the Python CLI through uv:

```bash
uv run --package terse-python-cli terse --help
uv run --package terse-python-cli terse --version
uv run --package terse-python-cli terse init --help
uv run --package terse-python-cli terse run --help
```

The CLI is still a skeleton right now, so end-to-end manual testing means verifying:

- the `terse` console entrypoint resolves correctly
- all commands show up in help
- options and arguments are wired correctly
- stub commands execute and print `Not yet implemented`

Example manual invocations:

```bash
uv run --package terse-python-cli terse init demo-project
uv run --package terse-python-cli terse generate
uv run --package terse-python-cli terse integrate
uv run --package terse-python-cli terse test demo-job
uv run --package terse-python-cli terse deploy
uv run --package terse-python-cli terse run demo-job --event '{"integrationType":"terse","eventType":"manual","formattedContent":"Manual trigger","debugLog":"Manual trigger"}'
```

If you want to bypass `uv run` and use the synced environment directly, you can also invoke the installed binary:

```bash
./.venv/bin/terse --help
```

### Astral Tooling

Run all Python tooling from the repo root.

Recommended wrapper scripts:

```bash
npm run python:setup
npm run python:refresh-types
npm run python:check
npm run python:test
npm run python:smoke
npm run python:build
```

Sync / install dependencies:

```bash
uv sync --all-packages
```

Refresh the lockfile after dependency changes:

```bash
uv lock
uv sync --all-packages
```

Refresh mirrored TypeScript shared types plus generated Python models:

```bash
npm run python:refresh-types
```

Lint:

```bash
uv run ruff check packages/terse-python-cli/src packages/terse-python-sdk/src
uv run ruff check --fix packages/terse-python-cli/src packages/terse-python-sdk/src
```

Format:

```bash
uv run ruff format packages/terse-python-cli/src packages/terse-python-sdk/src
uv run ruff format --check packages/terse-python-cli/src packages/terse-python-sdk/src
```

Type check:

```bash
uv run ty check packages/terse-python-cli/src packages/terse-python-sdk/src
```

Run Python unit tests:

```bash
uv run python -m unittest discover -s packages/terse-python-cli/tests
uv run python -m unittest discover -s packages/terse-python-sdk/tests
```

Build packages:

```bash
npm run python:build
```

Inspect resolved dependencies:

```bash
uv tree
uv tree --package terse-python-cli
uv tree --package terse-python-sdk
```

Shared-type sync only:

```bash
npm run sync:shared
```

### Python Shared Type Codegen

The Python SDK includes generated Pydantic models derived from the shared TypeScript definitions.

When the shared TypeScript source changes, regenerate the Python models from the repo root:

```bash
npm run python:refresh-types
```

Generated output is written into:

- `packages/terse-python-sdk/src/terse_sdk/generated/`
- `packages/terse-python-cli/shared/`
- `packages/terse-python-sdk/shared/`

After regenerating, run:

```bash
npm run python:check
```

### Recommended Python Dev Loop

For day-to-day Python development:

1. Run `npm run python:setup` the first time.
2. Make changes in `packages/terse-python-cli` and/or `packages/terse-python-sdk`.
3. If shared TS types changed, run `npm run python:refresh-types`.
4. Run `npm run python:check`.
5. Manually exercise the CLI with `uv run --package terse-python-cli terse ...` or `npm run python:smoke`.
6. Build the package artifacts with `npm run python:build` before publishing or release work.

## Code Formatting

We use **Prettier** for consistent code formatting across the team.

### Setup (One-time)

1. **Install the Prettier VS Code extension**
   - Search for "Prettier - Code formatter" in VS Code/Cursor extensions
   - Or install from: https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode

2. **Install dependencies** (if you haven't already)
   ```bash
   # In /frontend
   pnpm install

   # In /backend
   pnpm install
   ```

That's it! The repo includes:
- `.prettierrc` - Formatting rules (picked up automatically by the extension)
- `.vscode/settings.json` - Enables format-on-save for the whole team

### How It Works

- **Format on save**: Files auto-format when you save (Cmd+S / Ctrl+S)
- **Manual format**: Right-click → "Format Document" or use Shift+Alt+F (Windows) / Shift+Option+F (Mac)
- **Format entire codebase**:
  ```bash
  cd backend && pnpm run format
  cd frontend && pnpm run format
  ```
- **Check formatting (CI)**:
  ```bash
  pnpm run format:check
  ```
## Local Dev

you will need to make an ngrok account and get a dedicated dev url + access token. Then set the following env variables in backend/.env

NGROK_AUTH_TOKEN=38Zg3QagX6X9AnYc6WKqwedwefdGCY21_2nVjhcyeynHFNmnr7ijBw
NGROK_DOMAIN=abbie-smoking-yetta.ngrok-free.dev

Then, install ngrok with brew

```
brew install ngrok
```

After that, simply run pnpm run dev:tunnel and the rest will be taken care of.

Make sure to set your test apps (Slack github etc...) to the ngrok url.

## Database Migrations

We use Prisma with migrations.

1. Update the schema file. When you are happy, run the following **in the /backend folder**

```bash
pnpm exec prisma migrate dev --name <some_name>
```

When you are happy with local changes, you can push to prod. 

Production URL can be found on Render.com dashboard. (Or you can ask me)

```bash
DATABASE_URL="your_production_url" pnpm exec prisma migrate deploy
```

## The NPM Packages

To work with terse-cli locally, you need to point backend URL to localhost with:

```bash
export TERSE_BACKEND_URL="http://localhost:3001"
```

then run the terse commands right after
