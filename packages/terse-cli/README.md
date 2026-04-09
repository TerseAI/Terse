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

### `terse generate`

Generate TypeScript types for your connected integrations (creates `terse.generated.ts`).

### `terse integrate`

Open the integrations page in the Terse Web UI to connect services like GitHub, Slack, Linear, etc.

### `terse run [job-name]`

Execute a job's `onTrigger` handler locally with a mock or provided event.

```bash
terse run my-job --event '{"key": "value"}'
terse run my-job --event-file ./event.json
```

### `terse test [job-name]`

Fetch sample events from your connected integrations and run a job interactively.

### `terse deploy`

Deploy all jobs to the Terse platform. This syncs with the server — jobs that have been removed locally will be deleted remotely.

If `TERSE_JOB_URL` is unset, hosted deploys now prompt for confirmation before uploading a zip of the current project directory.

## Getting Started

```bash
terse init my-project
cd my-project
npm install
terse generate
terse test
terse deploy
```
