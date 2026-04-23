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

### `/terse:create <job-description>`

Create a new Terse SDK job. Describe what the job should do and the skill will:

1. Check your connected integrations in `terse.generated.ts`
2. Pick the right triggers for the events you want to react to
3. Configure skills for the services the agent needs
4. Write the `onTrigger` handler with proper typing and prompts
5. Add appropriate event filters

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
3. Implements the changes in `src/index.ts` / `src/main.py`.
4. Verifies locally with `terse replay <run-id>` against the failing run, or `terse test` against fresh sample events.
5. Runs the project's typechecker (`tsc --noEmit` for TypeScript) before reporting back.

**Example:**

```
/terse:improve Summarize PR
```

## What is Terse?

Terse is an automation platform where developers build background AI agents in TypeScript. Each agent reacts to events from integrated services (GitHub, Slack, Linear, Notion, Gmail, and more) and takes actions using an AI-powered agent runner.

Jobs are defined in `src/index.ts` using `createJob()`, tested with `terse test`, and deployed with `terse deploy`.

Learn more at [useterse.ai](https://useterse.ai) or see the [SDK docs](https://github.com/TerseAI/Terse/tree/main/packages/terse-sdk).
