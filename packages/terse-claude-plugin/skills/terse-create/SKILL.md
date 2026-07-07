---
name: terse-create
description: Create a Terse workflow. Use when the user wants to build an automation that reacts to events (GitHub PRs, Slack messages, Linear issues, cron schedules, webhooks) and takes actions, or wants to get started with Terse. Bootstraps a new Terse project first when none exists.
license: MIT
metadata:
  author: Terse AI
  version: "0.4.0"
  category: workflow
---

# Create a Terse Workflow

Create a Terse workflow based on: **$ARGUMENTS**

A workflow is the thing being automated; in code it is defined as a job (`createJob` in `src/terse.jobs.ts`).

## Reference docs

Terse evolves fast; the live docs are the source of truth for facts:

- Doc index: https://docs.useterse.ai/llms.txt — fetch this first to discover every page available, then pull the specific pages you need (triggers, skills, hosting, observability, etc.).
- CLI reference: https://docs.useterse.ai/reference/cli — authoritative source for `terse init`, `terse generate`, `terse test`, `terse secrets`, `terse deploy`, and friends.

Precedence: live docs win on facts (API signatures, CLI flags, availability). The bundled [code-conventions.md](references/code-conventions.md) wins on style — how job code is structured.

## Steps

**Do not search or read `node_modules/`.** Everything you need is in `src/terse.jobs.ts`, `src/jobs/`, `src/terse.generated.ts`, the bundled references, and live Terse docs — not inside dependency install dirs.

**Narrate the run.** The steps below group into phases: bootstrap (step 0), interview (1), research (2), shared understanding (3), design (4–8), build (9), swap and verify (10–11), deploy (12). Announce each phase transition in one line — what is about to happen and why — so the user always knows where the run is. Narration is non-blocking: never wait for a reply to an announcement; the run only pauses at the questions the steps themselves define. Headless runs emit the same narration.

### 0. Ensure a Terse project exists

Look for `terse.config.json` or `src/terse.generated.ts` in the working directory. If either exists, the project is set up — skip to step 1.

If neither exists, this is a fresh start: **read [references/bootstrap.md](references/bootstrap.md) now and follow it**, then come back and continue with step 1. The bootstrap runs `terse init` (scaffold, dependency install, browser login, remote project creation, `terse generate`) and covers error recovery.

If the user asked to self-host Terse rather than build a workflow on Terse Cloud, that is a different flow — hand off to the `terse-self-host` skill instead.

`src/terse.generated.ts` is the source of truth for connected integrations, available triggers, skills, resources, and deterministic wrappers. Do not run `terse integrate list` — the generated file already reflects what `terse integrate` connected.

If `src/terse.generated.ts` is missing in an existing project, run `terse generate` before inventing helpers. If it exists but does not expose the helper you need, rerun `terse generate`. Never edit the generated file directly.

### 1. Initial interview

Interview the user before doing any research: their answers set the direction the researchers take in step 2.

Ask about decisions and intent only — what should happen, on which events, for whom, and what a good outcome looks like. Do not ask about facts: what is connected, which triggers exist, what the docs support, and what an external API offers are exactly what step 2's researchers retrieve. If the request already pins down the intent unambiguously, skip straight to step 2.

Batch related questions, at most four per interruption. For every question, provide a recommended answer.

While interviewing, sharpen the domain language:

- When the user uses vague or overloaded terms, propose a precise canonical term. "You're saying 'account' — do you mean the Customer or the User? Those are different things."
- Stress-test domain relationships with concrete scenarios that probe edge cases and force the user to be precise about the boundaries between concepts.

If you are running headless with no one to answer, skip the interview, take your recommended answers, and state them with reasons in the final summary.

### 2. Dispatch researchers

Gather context through researchers — focused, read-only research tasks defined by self-contained templates in `references/`. Each produces a research brief in a fixed shape.

- **Workspace researcher** ([research-workspace.md](references/research-workspace.md)) — always dispatch. Reads `src/terse.generated.ts` and the job entry file, and reports which connected integrations, triggers, skills, toolbox methods, and resources match this workflow, and which needed services are missing.
- **Docs researcher** ([research-docs.md](references/research-docs.md)) — dispatch unless the workflow only uses primitives you have already verified against the live docs in this session. Reads the live Terse docs and reports the features relevant to this workflow, including whether each involved platform has a built-in integration type.
- **Integration researcher** ([research-integrations.md](references/research-integrations.md)) — dispatch only after the workspace and docs briefs confirm a needed service has no built-in Terse integration (rungs 3–4 of the integration ladder in [code-conventions.md](references/code-conventions.md)). Researches the platform's official SDK, auth model, and key endpoints.

**Dispatching a researcher.** For each one:

1. Read its template file from `references/`.
2. Replace the "Context from the orchestrator" comment block with real content: the workflow in one paragraph, the platforms/events/actions involved, and the interview answers that narrow the search.
3. If your harness can spawn subagents (an Agent/Task tool), pass the entire filled-in template as the subagent's prompt, using a read-only agent type — web-capable for the docs and integration researchers. The template is self-contained: the subagent needs no other context, and its reply is the research brief.
4. If it cannot, follow the filled-in template yourself, inline, and write out the same brief before moving on.

**Parallel where the harness allows.** Dispatch the workspace and docs researchers in one message so they run concurrently, and collect their briefs. Dispatch the integration researcher as soon as the briefs justify it — it can run while you conduct step 3. Inline execution runs the templates sequentially, in the order above.

Researchers are read-only: they must not edit files or run state-changing commands (`terse integrate connect`, `terse generate`, `terse deploy`).

### 3. Reach a shared understanding

Read the briefs, then bring the user everything that changes the design:

- Decisions the research raised: a missing integration to connect or work around, two plausible trigger choices, a docs feature that suggests a different shape for the workflow.
- Contradictions between what the user asked for and what exists. Surface them; do not silently resolve them.

The same interview rules apply: batch at most four questions, recommend an answer for each, look up facts instead of asking. Walk down each branch of the design tree, resolving dependencies between decisions one by one.

Do not start building until the user confirms you share an understanding of the workflow. If you are running headless, take your recommended answers and state them with reasons in the final summary.

### 4. Open the entry file

Open `src/terse.jobs.ts` (the canonical job entry file). The CLI can still load `src/index.ts` as a legacy fallback, and custom layouts can override the entry file with `--entry-file`.

If the repo already uses a custom entry file, follow that layout and pass `--entry-file` on later `terse` commands.
Job placement follows the project-layout rule in [code-conventions.md](references/code-conventions.md): the first job lives directly in `src/terse.jobs.ts`; adding a second job moves every job (the existing one too) into its own `src/jobs/<kebab-case-name>.ts` file and turns `src/terse.jobs.ts` into a manifest of side-effect imports. If the manifest layout is already in place, create the new job as its own file in `src/jobs/` and add its import line.
If the repo only has `src/index.ts`, treat that as a legacy fallback instead of creating a second competing entry file.
If no runtime entry exists yet, create one:

```typescript
import { createJob, generateText } from "terse-sdk"
```

### 5. Decide durability with the user

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

For durable jobs, the style rules in [code-conventions.md](references/code-conventions.md) ("Durable job style") govern the handler; the mechanics (`step()`, `jobStep`, `sleep`, `waitForInput`, replay model) are in https://docs.useterse.ai/core-concepts/durability.

### 6. Pick triggers

Choose triggers based on what events the job should respond to. The workspace brief lists the candidates; import trigger factories and resource constants from `./terse.generated`.

Only use triggers and resources that actually exist in `src/terse.generated.ts`. Do not invent constants that are not defined there.

### 7. Pick skills and connect integrations

**Skills shape what the model can do during a `generateText` run.** They scope the tools the model is allowed to pick. `toolbox.*` is unscoped and works without any skills at all.

Rules of thumb:
- If a step is fully deterministic, call `toolbox.<integration>.<method>` directly. No skill required.
- If the model needs to choose actions on an integration during a `generateText` run, that integration must be in `skills`.

When the workflow needs a platform, the briefs have already walked the integration ladder in [code-conventions.md](references/code-conventions.md) ("Integrating with a platform"): the workspace brief settles what is connected, the docs brief settles whether a built-in type exists, and the integration brief covers the external rungs. Confirm the rung and stop at the first one that works; for the community-wrapper rung, put the choice to the user with the brief's evidence.

Connecting a missing built-in integration type:

- For form installs, use `terse integrate connect <type> --field key=value --fields-stdin`
- Put secrets on `--fields-stdin`, not `--field`
- For OAuth installs, run `terse integrate connect <type> --json`. The CLI opens the user's browser automatically and exits 2 with a `handoff` payload that includes a `waitCommand`. Run that `waitCommand` (e.g. `terse integrate wait gmail`) to block until the user finishes authorization — it exits 0 when the connection is live. Only then continue. Do not dump the URL back to the user; the browser is already open.
- If you need multiple OAuth integrations, do them one at a time: `connect <a> --json` → `wait <a>` → `connect <b> --json` → `wait <b>`. Do not batch the connect calls; the user can only authorize one browser tab at a time anyway.
- After any connection or refresh, rerun `terse generate` and reopen `src/terse.generated.ts`

For anything past the built-in rungs, credentials go through project secrets: store with `terse secrets add <NAME>`, read `process.env.<NAME>` at the top of the job, fail fast with a custom error when missing.

### 8. Consider a filter

Add a `filter` function if the job should skip certain events:
- Bot-generated events (`event.sender.login.includes("[bot]")`)
- Draft PRs, WIP items, or specific labels
- Events from specific users or repos

Filters prevent unnecessary agent runs and save cost.

### 9. Build the handler in milestones

Read [code-conventions.md](references/code-conventions.md) now — it governs every line of handler code below. Before writing code that imports from `./terse.generated`, read `src/terse.generated.ts` yourself: the workspace brief guided the design, but exact names and signatures come from the file.

Never build the whole handler and test at the end. Slice the workflow into milestones — logical groupings like gather context, decide, act — and prove each one green before starting the next. The worked example in code-conventions.md shows a full workflow sliced into milestones; anchor your slicing on it.

Present the milestone plan before writing Milestone 0: one line per milestone naming what it does and whether it is deterministic or agentic. Do not wait for approval — step 3 already confirmed the design — but this roadmap is what every green announcement below reports against.

**Milestone 0 — tracer bullet.** Wire the trigger, the filter, and a stub handler that just logs the event. Then pin a sample event and prove the wiring fires:

```bash
terse test list "<job-name>" --json
terse test show <id> "<job-name>" --json
terse test run "<job-name>" --id <id>
```

Use `terse test show` to pick a representative event, then reuse that same `--id` for every later run so runs stay comparable. Use `terse test run --event-file <path>` or `--event <json>` when you already have the exact serialized trigger payload. If multiple jobs exist, pass the job name explicitly — non-interactive job loading cannot prompt. Reserve bare `terse test` for manual sessions with a TTY.

To test a specific payload, or when the sample buffer is empty (a fresh webhook has no stored deliveries), hand-write the event file once from this exact envelope. Do not guess it field-by-field:

```json
{
    "integrationType": "webhook",
    "eventType": "webhook",
    "formattedContent": "Webhook request received.",
    "debugLog": "Webhook Trigger (POST)",
    "data": {
        "integrationType": "webhook",
        "eventType": "webhook",
        "body": { "note": "the provider payload (e.g. the Stripe event) goes here" },
        "headers": { "content-type": "application/json" },
        "method": "POST"
    }
}
```

Three rules the validator enforces: `integrationType` and `eventType` are both literally `"webhook"` at both layers; `formattedContent` and `debugLog` are required strings on the outer object; the provider payload lives at `data.body`, with required siblings `data.headers` (a string-to-string map) and `data.method`.

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

When a milestone goes green, tell the user before starting the next one, in this shape:

> Milestone \<n\> (\<name\>) green — tsc passed, test run \<pinned-id\> passed, output: \<one-line judgment of the agent output against the prompt's intent\>

Omit the output clause for deterministic milestones. If the milestone deviated from the presented plan, say what changed and why in the same announcement. Do not wait for a reply.

Re-runs re-execute every earlier milestone, including its `generateText` calls; that cost is what makes green trustworthy. The test targets absorb the repeated side effects.

### 10. Swap to real targets

The swap is the final milestone. Enumerate every test resource you pointed at in step 9 and switch each back to the real one — list them explicitly so none is missed. Then run the full green check one last time. This run fires the real side effects once; tell the user before running it.

### 11. Final check

Verify the things that are easy to get wrong:
- Every `Triggers.<integration>.…`, `Skills.<integration>(…)`, resource constant, and tool call exists in `src/terse.generated.ts`. Inventing constants that aren't there is the most common failure.
- Known calls use `toolbox`; only steps that need judgment use `generateText`. `TerseAgent.create()` appears only when streaming or reusing an agent.
- `skills` lists every integration the model must call during a `generateText` run.
- Agent prompts include full event context via `event.formatForAgentRunner()`.
- Imports resolve to real exports from `terse-sdk` and `./terse.generated`.
- The code follows [code-conventions.md](references/code-conventions.md): no stray casts, exhaustive switches, custom error classes, stepdown ordering, types at the bottom.
- Durable jobs: every side effect lives in a step, branch helpers sit below the job in the same file, only serializable data crosses step boundaries.
- Every test target from step 9 is swapped back to the real resource.

### 12. Ask before deploying

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
