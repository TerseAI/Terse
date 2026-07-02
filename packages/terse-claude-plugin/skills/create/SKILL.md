---
name: create
description: Create a new Terse SDK job. Use when the user wants to build a new automation, agent, or job that reacts to events (GitHub PRs, Slack messages, Linear issues, cron schedules, etc.) and takes actions.
argument-hint: <job-description>
---

# Create a Terse Job

Create a new Terse SDK job based on: **$ARGUMENTS**

## Reference docs

The bundled [sdk-reference.md](../../reference/sdk-reference.md) covers the common path offline. Terse evolves fast, so pull the live docs whenever you reach past what the reference covers or aren't sure it's current:

- Doc index: https://docs.useterse.ai/llms.txt — fetch this first to discover every page available, then pull the specific pages you need (triggers, skills, hosting, observability, etc.).
- CLI reference: https://docs.useterse.ai/reference/cli — authoritative source for `terse init`, `terse generate`, `terse test`, `terse deploy`, and friends.

If anything in the bundled reference disagrees with the live docs, trust the live docs.

## Steps

**Do not search or read `node_modules/`.** Everything you need is in `src/terse.jobs.ts`, `src/terse.generated.ts`, the bundled [sdk-reference.md](../../reference/sdk-reference.md), and live Terse docs — not inside dependency install dirs.

`src/terse.generated.ts` is the source of truth for connected integrations, available triggers, skills, resources, and deterministic wrappers. Read it before choosing triggers or skills. Do not run `terse integrate list` — the generated file already reflects what `terse integrate` connected.

If `src/terse.generated.ts` is missing in an existing project, run `terse generate` before inventing helpers. If it exists but does not expose the helper you need, rerun `terse generate`. Never edit the generated file directly.

### 1. Open the entry file

Open `src/terse.jobs.ts` (the canonical job entry file). The CLI can still load `src/index.ts` as a legacy fallback, and custom layouts can override the entry file with `--entry-file`.

If the repo already uses a custom entry file, follow that layout and pass `--entry-file` on later `terse` commands.
If `src/terse.jobs.ts` exists, add the new job below the existing jobs.
If the repo only has `src/index.ts`, treat that as a legacy fallback instead of creating a second competing entry file.
If no runtime entry exists yet, create one:

```typescript
import { createJob, generateText } from "terse-sdk"
```

### 2. Pick triggers

Choose triggers based on what events the job should respond to. Import trigger factories and resource constants from `./terse.generated`.

Only use triggers and resources that actually exist in `src/terse.generated.ts`. Do not invent constants that are not defined there.

### 3. Pick skills and connect missing integrations

**Skills shape what the model can do during a `generateText` run.** They scope the tools the model is allowed to pick. `toolbox.*` is unscoped and works without any skills at all.

Rules of thumb:
- If a step is fully deterministic, call `toolbox.<integration>.<method>` directly. No skill required.
- If the model needs to choose actions on an integration during a `generateText` run, that integration must be in `skills`.

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

### 5 Decide to be Durable Or Not

By default, Terse Jobs are non-durable (think of it like a closure in the cloud). By flipping the durable flag to true in createJob, you can run the job in a durable execution environment similar to Temporal.

You would want to enable this to support Human in the loop approvals, pausing the jobs (ex: sleep for 2 hours) or for large long running multi step workflows that need to recover well in the event of a failure.

Using sleep() of jobStep() in a non-durable job will result in a runtime crash!

By default, all terse-sdk functions like state.get/set, toolbox.*, generateText are already durable steps so no changes needed there. However, this is a proper durable execution environment, if you have code that is not in a step, it will get re-run a bunch of times (remember, each step is queued and starts from the top of the function!!!). If the non-step code is non-indempotent, has side effects (ex: send an email), takes a long time or is just expensive you will have problems.

You can fix this with the jobStep() api:

```typescript
const pr = await jobStep({
  input: { number },
  inputSchema: z.object({ number: z.number() }),
  outputSchema: z.object({ title: z.string() }), // optional
  run: async ({ number }) => { /* octokit, fetch, etc. */ }
})
```

full docs at: https://docs.useterse.ai/core-concepts/durability

### 6. Write the onTrigger handler

Use the appropriate event type from `terse-sdk`. Plan the handler as a pipeline: filters and deterministic steps first, agent last (if at all).

**Deterministic steps** — map each known action to `toolbox` (no agent) or `agent.tools.*` (when you already have an agent with that integration in `skills`):

```typescript
import { toolbox, SlackChannel } from "./terse.generated"

// No agent required for a fixed Slack post
await toolbox.slack.sendMessage({
    channelId: SlackChannel.Engineering.channelId,
    message: `New PR: ${event.pullRequest.title}`,
    thread_ts: "",
    blocks: "",
})
```

**Agentic steps** — use `generateText` wherever judgment is required. The model runs a full agentic loop and can call any tool granted via `skills`. Include full event context via `event.formatForAgentRunner()`. Write clear, specific prompts; avoid vague instructions like "handle this event."

```typescript
import { generateText } from "terse-sdk"
import { Skills, Repos } from "./terse.generated"

const summary = await generateText({
    prompt: `Summarize this PR. Context: ${event.formatForAgentRunner()}`,
    skills: [Skills.github({ repos: [Repos.MyOrg.MyRepo] })],
})
```

Pass an `outputSchema` (a Zod schema) to get a typed, validated object back instead of a string. Reach for `TerseAgent.create()` directly only for streaming with `run()` or reusing one agent instance across several calls.

**Combined pattern** — deterministic setup, then a narrow agent task:

```typescript
const message = await toolbox.slack.sendMessage({ ... })
const summary = await generateText({
    prompt:
        `Summarize this PR and write a thread reply (thread_ts: ${message.message_ts}). ` +
        `Context: ${event.formatForAgentRunner()}`,
    skills: [Skills.github({ repos: [Repos.MyOrg.MyRepo] })],
})
await toolbox.slack.sendMessage({ channelId: ..., message: summary, thread_ts: message.message_ts, blocks: "" })
```

If the user's request is fully deterministic (e.g. "post X to Slack when Y happens"), do not create an agent at all.

### 7. Verify in an agent-friendly way

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

### 8. Final check

Verify the things that are easy to get wrong:
- Every `Triggers.<integration>.…`, `Skills.<integration>(…)`, resource constant, and tool call exists in `src/terse.generated.ts`. Inventing constants that aren't there is the most common failure.
- Known calls use `toolbox`; only steps that need judgment use `generateText`. `TerseAgent.create()` appears only when streaming or reusing an agent.
- `skills` lists every integration the model must call during a `generateText` run.
- Agent prompts include full event context via `event.formatForAgentRunner()`.
- Imports resolve to real exports from `terse-sdk` and `./terse.generated`.

### 9. Ask before deploying

Do not run `terse deploy` automatically. After the job is written and verified, ask the user whether to deploy it now.

Example prompt:

> The job is ready locally. Deploy it to production with `terse deploy`? (This syncs all jobs in the project — removed jobs are deleted remotely.)

- If the user says yes, run `terse deploy` and report the outcome.
- If the user says no or wants more changes, stop without deploying and remind them they can run `terse deploy` when ready.

## Example

```typescript
import { createJob, generateText, type GithubPROpenedTrigger } from "terse-sdk"
import { Triggers, Skills, Repos, SlackChannel, toolbox } from "./terse.generated"

createJob({
    name: "Summarize PR and notify Slack",
    triggers: [Triggers.github.onPROpened({ repo: Repos.MyOrg.MyRepo })],
    filter: async (event: GithubPROpenedTrigger) => {
        return !event.sender.login.includes("[bot]")
    },
    onTrigger: async (event: GithubPROpenedTrigger) => {
        // Deterministic: fixed channel, fixed opener — use toolbox, no agent needed
        const message = await toolbox.slack.sendMessage({
            channelId: SlackChannel.Engineering.channelId,
            message: `New PR from ${event.sender.login}: ${event.pullRequest.title}`,
            thread_ts: "",
            blocks: "",
        })

        // Agentic: only the summary needs judgment
        const summary = await generateText({
            prompt:
                `Summarize the changes in this PR. ` +
                `Focus on what changed, why it matters, and what reviewers should look at first. ` +
                `Keep it concise. Context: ${event.formatForAgentRunner()}`,
            skills: [Skills.github({ repos: [Repos.MyOrg.MyRepo] })],
        })

        // Deterministic: post the result back in thread
        await toolbox.slack.sendMessage({
            channelId: SlackChannel.Engineering.channelId,
            message: summary,
            thread_ts: message.message_ts,
            blocks: "",
        })
    },
})
```
