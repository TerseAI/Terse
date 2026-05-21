# Terse Plugin for Claude Code

Official Claude Code plugin for creating and improving [Terse](https://useterse.ai) SDK jobs.

## Installation

### From the marketplace

```shell
/plugin marketplace add TerseAI/Terse
/plugin install terse@terse-plugins
```

### Local development

```shell
claude --plugin-dir ./packages/terse-claude-plugin
```

## Skills

### `/terse:init [project-name]`

Get set up on Terse from scratch. The skill:

1. Checks whether `terse-cli` is installed and offers `npm i -g terse-cli` if not.
2. Decides whether to scaffold into the current directory (when empty) or a named subdirectory, and redirects to `terse attach` if you're inside an existing npm project.
3. Runs `terse init` and walks you through the WorkOS browser login. The CLI then creates a remote Terse project, installs dependencies, and runs `terse generate`.
4. Hands off with the next likely step (connect more integrations, `/terse:create` your first job, or `terse deploy`).

**Example:**

```
/terse:init my-automations
```

### `/terse:create <job-description>`

Create a new Terse SDK job. Describe what the job should do and the skill will:

1. Read `src/terse.generated.ts` for connected integrations, triggers, skills, and resources
2. Pick the right triggers and resources for the events you want to react to
3. Configure skills for the services the agent needs in `src/terse.jobs.ts`
4. Write the `onTrigger` handler with proper typing, prompts, and deterministic tool usage where appropriate
5. Verify with `terse test list|show|run` in non-interactive contexts, and reserve bare `terse test` for manual TTY sessions
6. Ask whether to run `terse deploy` — never deploy without confirmation

**Example:**

```
/terse:create a job that summarizes new PRs and posts to Slack
```

### `/terse:improve <job-name>`

Improve an existing Terse SDK job. The skill:

1. Pulls past production runs with `terse history` (filterable by status, with the trigger payload attached) to see what's actually been failing.
2. Analyzes the job across six dimensions:
   - **Prompt quality** — specificity, event context, edge cases, format
   - **Event filtering** — bot events, drafts, cost optimization
   - **Type safety** — typed events, type guards, proper imports
   - **Tool usage** — deterministic vs AI actions, multi-step workflows
   - **Error handling** — missing data, try/catch, prompt resilience
   - **Skill configuration** — completeness, scope, unnecessary skills
3. Implements the changes in `src/terse.jobs.ts` (or the repo's configured `--entry-file`).
4. Verifies locally with `terse replay <run-id>` against the failing run, or `terse test list|show|run` against fresh sample events.
5. Runs `tsc --noEmit` before reporting back
6. Asks whether to run `terse deploy` — never deploy without confirmation

**Example:**

```
/terse:improve Summarize PR
```

## What is Terse?

Terse is an automation platform where developers build background AI agents in TypeScript. Each agent reacts to events from integrated services (GitHub, Slack, Linear, Notion, Gmail, and more) and takes actions using an AI-powered agent runner.

Jobs are typically defined in `src/terse.jobs.ts` using `createJob()`, tested with `terse replay` or `terse test list|show|run`, and deployed with `terse deploy`.

Learn more at [useterse.ai](https://useterse.ai) or see the [SDK docs](https://github.com/TerseAI/Terse/tree/main/packages/terse-sdk).
