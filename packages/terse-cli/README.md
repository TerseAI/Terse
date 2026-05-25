# terse-cli

CLI for scaffolding, testing, and deploying [Terse](https://useterse.ai) workflows.

Terse is a code-first AI workflow platform. You write workflows in TypeScript, generate a typed SDK from your connected integrations, and deploy serverlessly. Full docs at [docs.useterse.ai](https://docs.useterse.ai).

## Install

```bash
npm install -g terse-cli
```

## Quickstart

```bash
terse init my-project
cd my-project
terse test
terse deploy
```

`terse init` scaffolds the project, installs dependencies, runs `terse login`, walks you through integrations, and runs `terse generate` to produce a typed SDK from your workspace.

See the [full quickstart](https://docs.useterse.ai/quickstart) for a guided walkthrough.

## Commands

| Command | What it does |
|---|---|
| `terse init [name]` | Scaffold a new project. Runs login, integrations review, and `terse generate`. |
| `terse attach` | Link an existing repo to Terse in self-hosted mode. |
| `terse generate` | Refresh `src/terse.generated.ts` with helpers for your connected integrations. |
| `terse integrate` | Connect, disconnect, or refresh integrations from the terminal. |
| `terse test [job]` | Run a workflow locally against a real or sample trigger event. |
| `terse deploy` | Package and deploy all workflows. Removed workflows are deleted remotely. |
| `terse replay <run-id>` | Re-run a past run's trigger event against your local code. |
| `terse history [job]` | List past runs or fetch full chat events for a single run. |
| `terse dashboard` | Open the Terse web app. |
| `terse login` / `terse logout` | Manage CLI credentials. |
| `terse docs` | Open the docs site. |

Full flag reference for every command: [docs.useterse.ai/reference/cli](https://docs.useterse.ai/reference/cli).

## Self-hosted layouts

If your app keeps workflow definitions outside the default entry file (`src/terse.jobs.ts`), pass `--entry-file` to `terse test` and `terse deploy`:

```bash
terse test --entry-file src/server.ts
terse deploy --entry-file src/server.ts
```

See [self-hosting](https://docs.useterse.ai/self-hosting) for the full setup.

## Local development

This package lives in a pnpm workspace alongside `terse-sdk` and `terse-types`. From the repo root:

```bash
pnpm install
pnpm run dev
pnpm run install-global
```
