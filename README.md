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
pnpm run python:test
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

### Publishing the npm Packages

The repo includes a publish script that handles version bumping, building, and publishing for `terse-types`, `terse-sdk`, and `terse-cli`.

Preview what will be published (no changes made):

```bash
pnpm run publish:npm -- --dry-run
```

Publish with npm 2FA:

```bash
pnpm run publish:npm -- --otp <code>
```

Publish without 2FA (if using an automation token):

```bash
pnpm run publish:npm
```

The script will:

1. Verify you are logged into npm
2. Prompt you to select a version bump for each package (`skip` / `patch` / `minor` / `major`)
3. Build all packages in dependency order (`terse-types` -> `terse-sdk` -> `terse-cli`)
4. Publish only the bumped packages
5. Commit the version changes to git

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

## Testing with Local SDK/CLI

When you run `terse init` to scaffold a test project, it installs `terse-sdk` from the npm registry. To test against your local changes instead, you need to link the local packages into the test environment.

### 1. Start the watchers

From the repo root, run the TypeScript watchers so changes to source files rebuild `dist/` immediately:

```bash
pnpm run dev
```

### 2. Scaffold a test environment

```bash
export TERSE_BACKEND_URL="http://localhost:3001"
terse init my-test-env
cd my-test-env
```

### 3. Link local packages

The test env needs both `terse-sdk` and its transitive dependency `terse-types` linked locally. From the test env directory, run:

```bash
npm install <path-to-repo>/packages/terse-sdk <path-to-repo>/terse-types
```

For example:

```bash
npm install ../../projects/Terse/packages/terse-sdk ../../projects/Terse/terse-types
```

This uses the `file:` protocol to symlink both packages into `node_modules/`. Since the watchers are running, any source changes in `terse-sdk`, `terse-types`, or `terse-cli` will be reflected immediately.

> **Note:** Use `npm install` (not `pnpm add`) from the test env. If you previously used pnpm to link, the `package.json` will contain `link:` protocol entries that npm cannot resolve. In that case, re-run the `npm install` command above to fix it.

#### Python

For Python test projects, install the local SDK in editable mode using `uv` from the test project directory:

```bash
uv pip install -e <path-to-repo>/packages/terse-python-sdk
```

For example:

```bash
uv pip install -e ../../projects/Terse/packages/terse-python-sdk
```

This installs the local SDK in editable mode, so any changes you make to the SDK source are reflected immediately without reinstalling.

> **Note:** Running `uv sync` will revert to the PyPI version of `terse-sdk`. Re-run the `uv pip install -e` command above after any `uv sync`.

### 4. Point CLI to local backend

Make sure each shell session that runs terse commands has the backend URL set:

```bash
export TERSE_BACKEND_URL="http://localhost:3001"
```

### 5. Authenticate against local WorkOS

If the CLI fails with a JWKS/key error during `terse login`, the CLI's WorkOS client ID may not match your backend. Set it to match `WORKOS_CLIENT_ID` in `backend/.env`:

```bash
export TERSE_WORKOS_CLIENT_ID="<client_id from backend/.env>"
```

## Documentation

We use Mintlify. Look at Mintlify docs for usage instructions.

To install mintlify, just run `pnpm i -g mint`
