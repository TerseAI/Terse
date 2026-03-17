# terse-cli

CLI tool for scaffolding, developing, testing, and deploying [Terse](https://useterse.ai) jobs.

## Installation

```bash
npm install -g terse-cli
```

## Commands

### `terse init [project-name]`

Scaffold a new Terse project with boilerplate code and config.

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

## Getting Started

```bash
terse init my-project
cd my-project
npm install
terse generate
terse test
terse deploy
```
