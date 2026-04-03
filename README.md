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

## Python SDK Development

The repo contains a Python workspace for the runtime SDK:

- `packages/terse-python-sdk`

CLI development lives in the TypeScript package at `packages/terse-cli`. Python tooling in this repo is for the SDK package.

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

- create `.venv/` at the repo root
- install the workspace packages in editable mode
- install shared dev tools like `ruff` and `ty`
- generate/update `uv.lock` when dependencies change

### CLI Development

For CLI work, use the TypeScript package directly:

- `packages/terse-cli` for the CLI implementation
- `packages/terse-sdk` for the runtime SDK used by the CLI
- `pnpm install` from the repo root to install workspace dependencies
- `pnpm run install-global` from the repo root to build and globally link `terse-sdk` and `terse-cli`
- `pnpm run dev` from the repo root to start the full workspace watch mode for `terse-types`, `terse-sdk`, `terse-cli`, `frontend`, and `backend`

### Astral Tooling

Run all Python tooling from the repo root.

Recommended wrapper scripts:

```bash
npm run python:setup
npm run python:check
npm run python:test
npm run python:dist:check
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

Lint:

```bash
uv run ruff check packages/terse-python-sdk/src
uv run ruff check --fix packages/terse-python-sdk/src
```

Format:

```bash
uv run ruff format packages/terse-python-sdk/src
uv run ruff format --check packages/terse-python-sdk/src
```

Type check:

```bash
uv run ty check packages/terse-python-sdk/src
```

Run Python tests:

```bash
uv run pytest packages/terse-python-sdk/tests
```

Build packages:

```bash
npm run python:build
npm run python:dist:check
```

Inspect resolved dependencies:

```bash
uv tree
uv tree --package terse-sdk
```


### Recommended Python Dev Loop

For day-to-day Python development:

1. Run `npm run python:setup` the first time.
2. Make changes in `packages/terse-python-sdk`.
3. Run `npm run python:check`.
4. Build the package artifacts with `npm run python:build` before publishing or release work.

### Publishing the Python SDK

Start from a clean working tree:

```bash
git status --short
```

The release-prep configs allow dirty trees so the second bump can run after the first one edits files, but you should still verify the tree is clean before starting the sequence.

Prepare the next SDK release version from the repo root:

```bash
npm run python:release:prep:sdk -- patch
```

You can also choose a different bump type or set an explicit version:

```bash
npm run python:release:prep:sdk -- minor
npm run python:release:prep:sdk -- --new-version 0.2.0
```

After the bump, refresh the workspace lockfile:

```bash
uv lock
```

Before publishing, build and validate the distributions from the repo root:

```bash
npm run python:dist:check
```

If you want to publish locally with a PyPI API token:

```bash
export TWINE_USERNAME=__token__
export TWINE_PASSWORD=pypi-...
npm run python:publish
```

The `python:publish` script first runs `npm run python:dist:check` and then uploads `dist/terse_sdk-*` with `twine`.

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

If you want webhook-compatible local dev, make an ngrok account and set these env variables in `backend/.env`:

DEV_TUNNEL=1
NGROK_AUTH_TOKEN=38Zg3QagX6X9AnYc6WKqwedwefdGCY21_2nVjhcyeynHFNmnr7ijBw
NGROK_DOMAIN=abbie-smoking-yetta.ngrok-free.dev

Then, install ngrok with brew

```
brew install ngrok
```

After that, run `pnpm run dev` from the repo root. The backend dev script will detect the tunnel config, start ngrok automatically, update `BACKEND_URL`, and then start the backend watcher.

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

## Documentation

We use Mintlify. Look at Mintlify docs for usage instructions.

To install mintlify, just run `pnpm i -g mint`
