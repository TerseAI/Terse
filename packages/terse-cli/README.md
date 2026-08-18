# terse-cli

CLI for scaffolding, testing, and deploying [Terse](https://useterse.ai) workflows.

Terse is the AI workflow platform for coding agents. You write workflows in TypeScript, generate a typed SDK from your connected integrations, and deploy serverlessly. Full docs at [docs.useterse.ai](https://docs.useterse.ai).

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

`terse init` scaffolds the project, installs dependencies, runs `terse auth login`, walks you through integrations, and runs `terse generate` to produce a typed SDK from your workspace.

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
| `terse auth login` / `terse auth logout` / `terse auth status` | Manage CLI credentials. Use `terse auth org switch` to change the active organization. |
| `terse docs` | Open the docs site. |

Full flag reference for every command: [docs.useterse.ai/reference/cli](https://docs.useterse.ai/reference/cli).

## Environment

| Variable | Description |
|---|---|
| `TERSE_API_KEY` | Your user token. Every command that talks to the control plane uses it. Resolved from the process environment (including a project `.env`) first, then from the credentials `terse auth login` stores per user. |
| `TERSE_PROJECT_KEY` | Project-scoped token used only by running workflow code. Injected automatically in Terse Cloud sandboxes; printed by `terse attach` for a self-hosted data plane. `terse run` and `terse test` derive it from your user token, so you never set it locally. |
| `TERSE_SIGNING_SECRET` | Self-hosted data planes only. HMAC key used to verify that incoming triggers came from the control plane. |
| `TERSE_BACKEND_URL` | Point the CLI at a self-hosted control plane. Defaults to `https://api.useterse.ai`. |

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
