---
name: terse-create
description: Create a Terse workflow. Use when the user wants to build an automation that reacts to events (GitHub PRs, Slack messages, Linear issues, cron schedules, webhooks) and takes actions, or wants to get started with Terse. Bootstraps a new Terse project first when none exists.
license: MIT
metadata:
  author: Terse AI
  version: "0.3.0"
  category: workflow
---

# Create a Terse Workflow

Create a Terse workflow based on: **$ARGUMENTS**

A workflow is the thing being automated; in code it is defined as a job (`createJob` in `src/terse.jobs.ts`).

## Reference docs

The bundled [sdk-reference.md](references/sdk-reference.md) covers the common path offline. Terse evolves fast, so pull the live docs whenever you reach past what the reference covers or aren't sure it's current:

- Doc index: https://docs.useterse.ai/llms.txt — fetch this first to discover every page available, then pull the specific pages you need (triggers, skills, hosting, observability, etc.).
- CLI reference: https://docs.useterse.ai/reference/cli — authoritative source for `terse init`, `terse generate`, `terse test`, `terse secrets`, `terse deploy`, and friends.

Precedence: live docs win on facts (API signatures, CLI flags, availability). The bundled [code-conventions.md](references/code-conventions.md) wins on style — how job code is structured.

## Steps

**Do not search or read `node_modules/`.** Everything you need is in `src/terse.jobs.ts`, `src/terse.generated.ts`, the bundled references, and live Terse docs — not inside dependency install dirs.

### 0. Ensure a Terse project exists

Look for `terse.config.json` or `src/terse.generated.ts` in the working directory. If either exists, the project is set up — skip to step 1.

If neither exists, this is a fresh start: **read [references/bootstrap.md](references/bootstrap.md) now and follow it**, then come back and continue with step 1. The bootstrap runs `terse init` (scaffold, dependency install, browser login, remote project creation, `terse generate`) and covers error recovery.

If the user asked to self-host Terse rather than build a workflow on Terse Cloud, that is a different flow — hand off to the `terse-self-host` skill instead.

`src/terse.generated.ts` is the source of truth for connected integrations, available triggers, skills, resources, and deterministic wrappers. Read it before choosing triggers or skills. Do not run `terse integrate list` — the generated file already reflects what `terse integrate` connected.

If `src/terse.generated.ts` is missing in an existing project, run `terse generate` before inventing helpers. If it exists but does not expose the helper you need, rerun `terse generate`. Never edit the generated file directly.

### 1. Reach a shared understanding of the workflow

Interview the user relentlessly about the workflow until you reach a shared understanding. Walk down each branch of the design tree, resolving dependencies between decisions one by one. For every question, provide a recommended answer.

Batch related questions, at most four per interruption.

If a *fact* can be found by exploring the codebase, `src/terse.generated.ts`, or the Terse docs, look it up rather than asking. The *decisions* are the user's: put each one to them and wait for the answer.

While interviewing, sharpen the domain language:

- When the user uses vague or overloaded terms, propose a precise canonical term. "You're saying 'account' — do you mean the Customer or the User? Those are different things."
- Stress-test domain relationships with concrete scenarios that probe edge cases and force the user to be precise about the boundaries between concepts.
- When the user states how something works, check whether the code agrees. If you find a contradiction, surface it.

Do not start building until the user confirms you share an understanding of the workflow. If you are running headless with no one to answer, skip the interview, take your recommended answers, and state them with reasons in the final summary.

### 2. Open the entry file

Open `src/terse.jobs.ts` (the canonical job entry file). The CLI can still load `src/index.ts` as a legacy fallback, and custom layouts can override the entry file with `--entry-file`.

If the repo already uses a custom entry file, follow that layout and pass `--entry-file` on later `terse` commands.
If `src/terse.jobs.ts` exists, add the new job below the existing jobs.
If the repo only has `src/index.ts`, treat that as a legacy fallback instead of creating a second competing entry file.
If no runtime entry exists yet, create one:

```typescript
import { createJob, generateText } from "terse-sdk"
```

### 3. Decide durability with the user

Durability changes how the handler is structured, so settle it before writing any handler code.

Form a recommendation first. Recommend `durable: true` when the workflow involves any of: human input or approval (`waitForInput`), timed waits (`sleep`), or three or more side-effecting milestones where a mid-run failure would leave visible half-done work. Otherwise recommend non-durable.

Then ask, presenting your recommendation as the default. Use this copy:

> **Should this job be durable?**
>
> - **Durable** — survives restarts, can pause and wait. e.g. "When a refund over $500 comes in, wait for manager approval in Slack, then process it." The job can sleep for days without losing state.
> - **Non-durable** (default) — a closure in the cloud. e.g. "When a PR opens, post a summary to Slack." Runs once, fast, no constraints; a crash just means that one run failed.
>
> Tradeoff: durable requires every side effect to live in a `step()` and all step data to be serializable.
>
> Recommended for this workflow: \<your recommendation and one-line reason\>

If you are running headless with no one to answer, take your recommendation silently and state the choice and its reason in the final summary.

For durable jobs, the style rules in [code-conventions.md](references/code-conventions.md) ("Durable job style") govern the handler; the mechanics (`step()`, `jobStep`, `sleep`, `waitForInput`, replay model) are in [sdk-reference.md](references/sdk-reference.md) and https://docs.useterse.ai/core-concepts/durability.

### 4. Pick triggers

Choose triggers based on what events the job should respond to. Import trigger factories and resource constants from `./terse.generated`.

Only use triggers and resources that actually exist in `src/terse.generated.ts`. Do not invent constants that are not defined there.

### 5. Pick skills and connect integrations

**Skills shape what the model can do during a `generateText` run.** They scope the tools the model is allowed to pick. `toolbox.*` is unscoped and works without any skills at all.

Rules of thumb:
- If a step is fully deterministic, call `toolbox.<integration>.<method>` directly. No skill required.
- If the model needs to choose actions on an integration during a `generateText` run, that integration must be in `skills`.

When the workflow needs a platform, work down the integration ladder in [code-conventions.md](references/code-conventions.md) ("Integrating with a platform") and stop at the first rung that works: built-in integration → connect a missing built-in type → official TypeScript SDK (validated as official) → the user's choice between a researched community wrapper and a hand-rolled typed fetch client.

Connecting a missing built-in integration type:

- For form installs, use `terse integrate connect <type> --field key=value --fields-stdin`
- Put secrets on `--fields-stdin`, not `--field`
- For OAuth installs, run `terse integrate connect <type> --json`. The CLI opens the user's browser automatically and exits 2 with a `handoff` payload that includes a `waitCommand`. Run that `waitCommand` (e.g. `terse integrate wait gmail`) to block until the user finishes authorization — it exits 0 when the connection is live. Only then continue. Do not dump the URL back to the user; the browser is already open.
- If you need multiple OAuth integrations, do them one at a time: `connect <a> --json` → `wait <a>` → `connect <b> --json` → `wait <b>`. Do not batch the connect calls; the user can only authorize one browser tab at a time anyway.
- After any connection or refresh, rerun `terse generate` and reopen `src/terse.generated.ts`

For anything past the built-in rungs, credentials go through project secrets: store with `terse secrets add <NAME>`, read `process.env.<NAME>` at the top of the job, fail fast with a custom error when missing.

### 6. Consider a filter

Add a `filter` function if the job should skip certain events:
- Bot-generated events (`event.sender.login.includes("[bot]")`)
- Draft PRs, WIP items, or specific labels
- Events from specific users or repos

Filters prevent unnecessary agent runs and save cost.

### 7. Build the handler in milestones

Read [code-conventions.md](references/code-conventions.md) now — it governs every line of handler code below.

Never build the whole handler and test at the end. Slice the workflow into milestones — logical groupings like gather context, decide, act — and prove each one green before starting the next. The worked example in code-conventions.md shows a full workflow sliced into milestones; anchor your slicing on it.

**Milestone 0 — tracer bullet.** Wire the trigger, the filter, and a stub handler that just logs the event. Then pin a sample event and prove the wiring fires:

```bash
terse test list "<job-name>" --json
terse test show <id> "<job-name>" --json
terse test run "<job-name>" --id <id>
```

Use `terse test show` to pick a representative event, then reuse that same `--id` for every later run so runs stay comparable. Use `terse test run --event-file <path>` or `--event <json>` when you already have the exact serialized trigger payload. If multiple jobs exist, pass the job name explicitly — non-interactive job loading cannot prompt. Reserve bare `terse test` for manual sessions with a TTY.

**Test targets.** Before the first milestone that writes to an external surface, ask the user once: "Which channel/repo should I use for test runs? (I'll swap to the real targets at the end.)" Point side-effecting calls at those test resources while building. If the user says to use the real ones, proceed live.

**Each following milestone.** Plan the pipeline deterministic-first, agent-last:

- **Deterministic milestones** — map each known action to `toolbox` (no agent):

  ```typescript
  import { toolbox, SlackChannel } from "./terse.generated"

  await toolbox.slack.sendMessage({
      channelId: SlackChannel.Engineering.channelId,
      message: `New PR: ${event.pullRequest.title}`,
      thread_ts: "",
      blocks: "",
  })
  ```

- **Agentic milestones** — use `generateText` wherever judgment is required (summarize, triage, draft). Include full event context via `event.formatForAgentRunner()`; write specific prompts, and pass an `outputSchema` (a Zod schema) to get a typed, validated object back. Reach for `TerseAgent.create()` only for streaming with `run()` or reusing one agent instance across calls.

- If the user's request is fully deterministic (e.g. "post X to Slack when Y happens"), do not create an agent at all.

After adding each milestone, take it to **green** — all three, in order:

1. `pnpm exec tsc --noEmit` passes (use `npx tsc --noEmit` if that matches the project).
2. `terse test run "<job-name>" --id <pinned-id>` completes without error.
3. For agentic milestones, read the actual output (the message text, the summary) and judge it against the prompt's intent. Exit code 0 is not green on its own.

Re-runs re-execute every earlier milestone, including its `generateText` calls; that cost is what makes green trustworthy. The test targets absorb the repeated side effects.

### 8. Swap to real targets

The swap is the final milestone. Enumerate every test resource you pointed at in step 7 and switch each back to the real one — list them explicitly so none is missed. Then run the full green check one last time. This run fires the real side effects once; tell the user before running it.

### 9. Final check

Verify the things that are easy to get wrong:
- Every `Triggers.<integration>.…`, `Skills.<integration>(…)`, resource constant, and tool call exists in `src/terse.generated.ts`. Inventing constants that aren't there is the most common failure.
- Known calls use `toolbox`; only steps that need judgment use `generateText`. `TerseAgent.create()` appears only when streaming or reusing an agent.
- `skills` lists every integration the model must call during a `generateText` run.
- Agent prompts include full event context via `event.formatForAgentRunner()`.
- Imports resolve to real exports from `terse-sdk` and `./terse.generated`.
- The code follows [code-conventions.md](references/code-conventions.md): no stray casts, exhaustive switches, custom error classes, stepdown ordering, types at the bottom.
- Durable jobs: every side effect lives in a step, branch helpers sit below the job in the same file, only serializable data crosses step boundaries.
- Every test target from step 7 is swapped back to the real resource.

### 10. Ask before deploying

Do not run `terse deploy` automatically. After the job is written and verified, ask the user whether to deploy it now.

Example prompt:

> The workflow is ready locally. Deploy it to production with `terse deploy`? (This syncs all jobs in the project — removed jobs are deleted remotely.)

- If the user says yes, run `terse deploy` and report the outcome.
- If the user says no or wants more changes, stop without deploying and remind them they can run `terse deploy` when ready.

## Example

A complete non-durable job (a durable worked example lives in [code-conventions.md](references/code-conventions.md)):

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
