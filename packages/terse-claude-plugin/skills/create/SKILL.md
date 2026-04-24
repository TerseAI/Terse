---
name: create
description: Create a new Terse SDK job. Use when the user wants to build a new automation, agent, or job that reacts to events (GitHub PRs, Slack messages, Linear issues, cron schedules, etc.) and takes actions.
argument-hint: <job-description>
---

# Create a Terse Job

Create a new Terse SDK job based on: **$ARGUMENTS**

## Reference docs

The bundled [sdk-reference.md](reference/sdk-reference.md) is a quick offline cheat sheet, but Terse evolves fast. Always pull the live docs before writing non-trivial code:

- Doc index: https://docs.useterse.ai/llms.txt — fetch this first to discover every page available, then pull the specific pages you need (triggers, skills, hosting, observability, etc.).
- CLI reference: https://docs.useterse.ai/reference/cli — authoritative source for `terse init`, `terse generate`, `terse test`, `terse deploy`, and friends.

If anything in the bundled reference disagrees with the live docs, trust the live docs.

## Steps

### 1. Detect the project language and read the generated helpers

If the user explicitly wants a new Terse job in an empty or brand-new directory, treat that as a request to scaffold a fresh project there by default.

- If the current directory is the target empty directory, run `terse init`.
- If the user wants a new subdirectory created from the current directory, run `terse init <name>`.
- Do not treat missing `package.json`, `tsconfig.json`, or `src/terse.generated.ts` as blockers in this case. `terse init` is what creates that scaffold.
- After `terse init`, continue with integration inspection, verify generated helpers, and then implement the job in `src/terse.jobs.ts`.

Use project markers to detect the language:

- TypeScript: `package.json` and `tsconfig.json`

These are the same markers the `terse` CLI uses to detect a TypeScript Terse project.

Then open the generated file for that language:

- TypeScript: `src/terse.generated.ts`

The canonical TypeScript job entry file is `src/terse.jobs.ts`.
The CLI can still load `src/index.ts` as a legacy fallback, and custom layouts can override the entry file with `--entry-file`.

If the generated file doesn't exist in an existing project, run `terse generate --quiet` before inventing helpers.
If it exists but does not expose the helper the user expects, rerun `terse generate --quiet` before inventing anything.
In a brand-new empty directory, scaffold with `terse init` before reaching for `terse generate`.
Never edit the generated file directly.

### 2. Inspect integration state first

Before choosing triggers or skills, check what the workspace is actually connected to:

For a freshly scaffolded project, do this after `terse init`, not before.

```bash
terse integrate list --json
terse integrate describe <type> --json
```

Use these commands to confirm:

- which integrations are connected
- whether the install is OAuth or form-based
- which fields a form install requires

Do not guess available integrations, resource scopes, or credential fields.

When a CLI command is run with `--json`, it may return a structured error envelope instead of prose.
If `error.actionRequired` is `true` or the command exits with code `2`, stop and surface the required next step or URL to the user instead of retrying blindly.

### 3. Open the entry file

Open the language-specific entry file:

- TypeScript: prefer `src/terse.jobs.ts`

If the repo already uses a custom entry file, follow that layout and pass `--entry-file` on later `terse` commands.
If `src/terse.jobs.ts` exists, add the new job below the existing jobs.
If the repo only has `src/index.ts`, treat that as a legacy fallback instead of creating a second competing entry file.
If no runtime entry exists yet, create one for the current language:

```typescript
import { createJob, TerseAgent } from "terse-sdk"
```

### 4. Pick triggers

Choose triggers based on what events the job should respond to. Import trigger factories and resource constants from the generated file for the current language.

Only use triggers and resources that actually exist in the generated file. Do not invent constants that are not defined there.

### 5. Pick skills and connect missing integrations

Add skill configs for every integration the model needs during `run()` or `runAndWait()`. Include all services mentioned in the user's request plus any integrations the model will need while reasoning.

Deterministic wrappers like `agent.tools.*` and `agent.executeTool()` are separate: they are direct code paths, not model-selected tools. Do not use the `skills` list as a proxy for whether direct code can call a generated wrapper.

The helper surface is language-specific. The CLI supports multiple languages, but it does not guarantee the same generated integrations in both.

If a required integration is missing:

- For form installs, use `terse integrate connect <type> --field key=value --fields-stdin`
- Put secrets on `--fields-stdin`, not `--field`
- For OAuth installs, run `terse integrate connect <type> --json`. The CLI opens the user's browser automatically and exits 2 with a `handoff` payload that includes a `waitCommand`. Run that `waitCommand` (e.g. `terse integrate wait gmail`) to block until the user finishes authorization — it exits 0 when the connection is live. Only then continue. Do not dump the URL back to the user; the browser is already open.
- If you need multiple OAuth integrations, do them one at a time: `connect <a> --json` → `wait <a>` → `connect <b> --json` → `wait <b>`. Do not batch the connect calls; the user can only authorize one browser tab at a time anyway.
- After any connection or refresh, rerun `terse generate --quiet` and reopen `src/terse.generated.ts`

### 6. Consider a filter

Add a `filter` function if the job should skip certain events:
- Bot-generated events (`event.sender.login.includes("[bot]")`)
- Draft PRs, WIP items, or specific labels
- Events from specific users or repos

Filters prevent unnecessary agent runs and save cost.

### 7. Write the onTrigger handler

Use the appropriate event type from the SDK for the current language.

**Always** include the full event context in your prompt:

- TypeScript: `event.formatForAgentRunner()`

Choose the right approach for the handler:
- **AI decision-making**
TypeScript: `agent.runAndWait(prompt, event)`
- **Deterministic actions**
TypeScript: `agent.tools.*` or `agent.executeTool()`
- **Combined**: Do a deterministic action first, then pass the result into an agent prompt

Write clear, specific prompts. Tell the agent exactly what to do and what format to use. Avoid vague instructions like "handle this event."

### 8. Verify in an agent-friendly way

Do not assume bare `terse test` is available. It needs an interactive terminal.

In non-interactive contexts, prefer:

```bash
terse test list "<job-name>" --json
terse test show <id> "<job-name>" --json
terse test run "<job-name>" --id <id>
```

Use `terse test show` when you need to inspect the selected event before running it.
Use `terse test run --event-file <path>` or `--event <json>` when you already have the exact serialized trigger payload.

If multiple jobs exist, pass the job name explicitly because non-interactive job loading cannot prompt.
Reserve bare `terse test` for manual sessions with a TTY.

### 9. Final check

Verify:
- TypeScript imports reference actual exports from `terse-sdk` and `./terse.generated`
- The job lives in `src/terse.jobs.ts` unless the repo intentionally uses a custom or legacy entry file
- The job `name` is unique and descriptive
- Every integration the agent needs is in `skills`
- The event type in `onTrigger` matches the trigger type
- The generated helpers reflect the current integration state
- The prompt includes full event context for the language
- Verification uses `terse test list/show/run` when the agent is not in an interactive terminal

## Example

```typescript
import { createJob, TerseAgent, type GithubPRTrigger } from "terse-sdk"
import { GitHub, Slack, Repos, SlackChannel } from "./terse.generated"

createJob({
    name: "Summarize PR and notify Slack",
    triggers: [GitHub.onPROpened({ repo: Repos.MyOrg.MyRepo })],
    filter: async (event: GithubPRTrigger) => {
        return !event.sender.login.includes("[bot]")
    },
    onTrigger: async (event: GithubPRTrigger) => {
        const agent = TerseAgent.create({
            prompt: "You summarize pull requests and send concise Slack updates.",
            skills: [
                GitHub.skill({ repos: [Repos.MyOrg.MyRepo] }),
                Slack.skill({ channel: SlackChannel.Engineering }),
            ],
        })

        const message = await agent.tools.slack.sendMessage({
            channelId: SlackChannel.Engineering.channelId,
            message: `New PR from ${event.sender.login}: ${event.pullRequest.title}`,
            thread_ts: "",
            blocks: "",
        })

        await agent.runAndWait(
            `Summarize the changes in this PR and post as a thread reply ` +
            `(thread_ts: ${message.message_ts}). ` +
            `Focus on what changed, why it matters, and what reviewers should look at first. ` +
            `Keep it concise. Context: ${event.formatForAgentRunner()}`
        )
    },
})
```
