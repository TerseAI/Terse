# terse-cli

CLI tool for scaffolding, developing, testing, and deploying [Terse](https://useterse.ai) jobs.

## Installation

```bash
npm install -g terse-cli
```

## Local Development

From the repo root, use the pnpm workspace so `terse-cli` resolves the local `terse-sdk` and `terse-types` packages automatically:

```bash
pnpm install
pnpm run dev
pnpm run install-global
```

## Commands

### `terse init [project-name]`

Scaffold a new Terse project with boilerplate code and config.

If you run `terse init` inside an existing npm project with no project name, the CLI uses attach mode instead of overwriting `package.json`. In attach mode it asks whether you want to self-host via `TERSE_JOB_URL` or use serverless deploys, and it warns that serverless deploys upload a zip of the current project directory to GCS.

TypeScript projects register jobs in `src/terse.jobs.ts`. In existing apps, import that file from your normal startup path.
If your self-hosted app keeps jobs in another file, pass `--entry-file` to `terse test`, `terse run`, or `terse deploy`.

### `terse generate`

Generate TypeScript types for your connected integrations (creates `terse.generated.ts`).

### `terse integrate`

Open the integrations page in the Terse Web UI to connect services like GitHub, Slack, Linear, etc.

### `terse run [job-name]`

Execute a job's `onTrigger` handler locally with a serialized event payload.

```bash
terse run my-job --event-file ./event.json
terse run my-job --entry-file src/server.py --event-file ./event.json
```

### `terse test [job-name]`

Fetch sample events from your connected integrations and run a job interactively.

For self-hosted or custom layouts that do not use the canonical entry file, pass `--entry-file` explicitly:

```bash
terse test --entry-file src/server.ts
terse test --entry-file src/server.py
```

### `terse deploy`

Deploy all jobs to the Terse platform. This syncs with the server — jobs that have been removed locally will be deleted remotely.

If `TERSE_JOB_URL` is unset, hosted deploys now prompt for confirmation before uploading a zip of the current project directory.

### `terse serve`

Start a local job server that receives job dispatches from the Terse backend and executes them in-process — using your local `node_modules` instead of the cloud sandbox. Useful during active development to skip sandbox cold starts and iterate quickly.

```bash
terse serve                          # Listen on port 3000
terse serve --port 4242              # Custom port
terse serve --cwd /path/to/agent     # Load jobs from a different directory
terse serve --entry-file src/jobs.ts # Override the default entry file
```

**Setup:**

1. Add `TERSE_SIGNING_SECRET=<value>` to your `.env` file. Find the signing secret in the Terse dashboard under your agent's settings.
2. Set your agent's **Remote Server URL** to `http://localhost:3000` (or your chosen port) in the Terse dashboard.
3. Run `terse serve` — it will print the loaded jobs and wait for dispatches.
4. Fire a trigger as normal. The backend will route the job to your local server instead of the cloud sandbox.

When you're done, remove the Remote Server URL from the dashboard to switch back to cloud execution.

**Using a local SDK build:**

If you're developing changes to `terse-sdk` locally, point your job project at the local package before running `terse serve`:

```bash
# In your job project's package.json:
{ "dependencies": { "terse-sdk": "file:../terse-sdk" } }

npm install
terse serve
```

`terse serve` executes jobs in-process using your project's own `node_modules`, so it picks up the local SDK automatically.

**Multi-project setup:**

If your jobs live in a separate directory, use `--cwd`:

```bash
terse serve --cwd /path/to/my-agent-project
```

## Getting Started

```bash
terse init my-project
cd my-project
npm install
terse generate
terse test
terse deploy
```
