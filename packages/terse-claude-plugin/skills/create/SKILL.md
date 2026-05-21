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

`src/terse.generated.ts` is the source of truth for connected integrations, available triggers, skills, resources, and deterministic wrappers. Read it before choosing triggers or skills. Do not run `terse integrate list` — the generated file already reflects what `terse integrate` connected.

If `src/terse.generated.ts` is missing in an existing project, run `terse generate` before inventing helpers. If it exists but does not expose the helper you need, rerun `terse generate`. Never edit the generated file directly.

### 1. Open the entry file

Open `src/terse.jobs.ts` (the canonical job entry file). The CLI can still load `src/index.ts` as a legacy fallback, and custom layouts can override the entry file with `--entry-file`.

If the repo already uses a custom entry file, follow that layout and pass `--entry-file` on later `terse` commands.
If `src/terse.jobs.ts` exists, add the new job below the existing jobs.
If the repo only has `src/index.ts`, treat that as a legacy fallback instead of creating a second competing entry file.
If no runtime entry exists yet, create one:

```typescript
import { createJob, TerseAgent } from "terse-sdk"
```

### 2. Pick triggers

Choose triggers based on what events the job should respond to. Import trigger factories and resource constants from `./terse.generated`.

Only use triggers and resources that actually exist in `src/terse.generated.ts`. Do not invent constants that are not defined there.

### 3. Pick skills and connect missing integrations

Add skill configs for every integration the model needs during `run()` or `runAndWait()`. Include all services mentioned in the user's request plus any integrations the model will need while reasoning.

Deterministic wrappers like `agent.tools.*` and `agent.executeTool()` are separate: they are direct code paths, not model-selected tools. Do not use the `skills` list as a proxy for whether direct code can call a generated wrapper.

If a required integration is missing from `src/terse.generated.ts`:

- For form installs, use `terse integrate connect <type> --field key=value --fields-stdin`
- Put secrets on `--fields-stdin`, not `--field`
- For OAuth installs, run `terse integrate connect <type> --json`. The CLI opens the user's browser automatically and exits 2 with a `handoff` payload that includes a `waitCommand`. Run that `waitCommand` (e.g. `terse integrate wait gmail`) to block until the user finishes authorization — it exits 0 when the connection is live. Only then continue. Do not dump the URL back to the user; the browser is already open.
- If you need multiple OAuth integrations, do them one at a time: `connect <a> --json` → `wait <a>` → `connect <b> --json` → `wait <b>`. Do not batch the connect calls; the user can only authorize one browser tab at a time anyway.
- After any connection or refresh, rerun `terse generate` and reopen `src/terse.generated.ts`

### 4. Consider a filter

Add a `filter` function if the job should skip certain events:
- Bot-generated events (`event.sender.login.includes("[bot]")`)
- Draft PRs, WIP items, or specific labels
- Events from specific users or repos

Filters prevent unnecessary agent runs and save cost.

### 5. Write the onTrigger handler

Use the appropriate event type from `terse-sdk`.

**Always** include the full event context in your prompt via `event.formatForAgentRunner()`.

Choose the right approach for the handler:
- **AI decision-making**: `agent.runAndWait(prompt, event)`
- **Deterministic actions**: `agent.tools.*` or `agent.executeTool()`
- **Combined**: Do a deterministic action first, then pass the result into an agent prompt

Write clear, specific prompts. Tell the agent exactly what to do and what format to use. Avoid vague instructions like "handle this event."

### 6. Verify in an agent-friendly way

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

### 7. Final check

Verify:
- Imports reference actual exports from `terse-sdk` and `./terse.generated`
- The job lives in `src/terse.jobs.ts` unless the repo intentionally uses a custom or legacy entry file
- The job `name` is unique and descriptive
- Every integration the agent needs is in `skills`
- The event type in `onTrigger` matches the trigger type
- Triggers, skills, and resources used in the job exist in `src/terse.generated.ts`
- The prompt includes full event context via `event.formatForAgentRunner()`
- Verification uses `terse test list/show/run` when the agent is not in an interactive terminal

### 8. Ask before deploying

Do not run `terse deploy` automatically. After the job is written and verified, ask the user whether to deploy it now.

Example prompt:

> The job is ready locally. Deploy it to production with `terse deploy`? (This syncs all jobs in the project — removed jobs are deleted remotely.)

- If the user says yes, run `terse deploy` and report the outcome.
- If the user says no or wants more changes, stop without deploying and remind them they can run `terse deploy` when ready.

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
