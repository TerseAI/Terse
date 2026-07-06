# Terse Agent Skills & Claude Code Plugin

Official agent skills for [Terse](https://useterse.ai), the AI workflow platform for coding agents. The skills follow the [Agent Skills](https://agentskills.io) open standard and work in Claude Code, Cursor, Codex, and 70+ other agents; the package doubles as a Claude Code plugin.

## Installation

### Everything in one command (recommended)

```shell
npx terse-cli install
```

Installs the Terse CLI globally, installs the skills into every coding agent detected on your machine, and logs you in. Later, `terse update` refreshes both.

### Skills only, via the skills CLI

```shell
npx skills add TerseAI/Terse            # all skills, all detected agents
npx skills add TerseAI/Terse --skill terse-create   # just one
```

### As a Claude Code plugin

```shell
/plugin marketplace add TerseAI/Terse
/plugin install terse@terse-plugins
```

### Local development

```shell
claude --plugin-dir ./packages/terse-claude-plugin
```

## Skills

Skills are model-invoked: describe what you want and the agent picks the right one. In Claude Code you can also call them directly (as `/terse-create` when installed via the skills CLI, or `/terse:terse-create` when installed as a plugin).

### `terse-create`

Create a Terse workflow. If no Terse project exists yet, it bootstraps one first (`terse init`: scaffold, dependencies, browser login, `terse generate`), then:

1. Reads `src/terse.generated.ts` for connected integrations, triggers, skills, and resources
2. Picks the right triggers and resources for the events you want to react to
3. Connects missing integrations and configures skills in `src/terse.jobs.ts`
4. Writes the `onTrigger` handler: typed events, specific prompts, and `toolbox` for known calls, reserving `generateText` for the steps that need judgment
5. Verifies with `terse test list|show|run`, and asks before running `terse deploy`

**Example:** "build me a workflow that summarizes new PRs and posts to Slack"

### `terse-improve`

Improve an existing Terse workflow:

1. Pulls past production runs with `terse history` to see what's actually been failing
2. Analyzes tool usage, prompt quality, event filtering, error handling, and skill configuration
3. Implements the changes in `src/terse.jobs.ts`
4. Verifies locally with `terse replay <run-id>` against the failing run, or `terse test list|show|run`
5. Runs `tsc --noEmit`, summarizes what changed, and asks before `terse deploy`

**Example:** "my pr-triage workflow keeps timing out, fix it"

### `terse-self-host`

Self-host the Terse control plane on your own infrastructure via `npx create-terse`: Docker prerequisites, the interactive and non-interactive bootstrap, post-install integration setup (OAuth env vars), and the caveats to know before exposing the instance beyond `localhost`.

**Example:** "help me run Terse on my own server"

## Repository layout

- `skills/<name>/SKILL.md` — one folder per skill, per the [Agent Skills spec](https://agentskills.io/specification)
- `skills/<name>/references/` — per-skill reference docs. `sdk-reference.md` is vendored from `reference/sdk-reference.md`; edit the canonical copy and run `node scripts/sync-references.mjs` (CI fails on drift)
- `.claude-plugin/marketplace.json` (repo root) is the single source of truth for the official skill set: Claude Code installs from it, and `terse install`/`terse update` fetch it from main to decide what to install

## What is Terse?

Terse is the AI workflow platform for coding agents. Workflows run in TypeScript, react to events from integrated services (GitHub, Slack, Linear, Notion, Gmail, and more), and take actions using an AI-powered agent runner. In code, a workflow is a job: defined in `src/terse.jobs.ts` with `createJob()`, tested with `terse replay` or `terse test`, deployed with `terse deploy`.

Learn more at [useterse.ai](https://useterse.ai) or the [docs](https://docs.useterse.ai).
