---
name: terse-improve
description: Improve an existing Terse workflow. Use when the user wants to fix, optimize, refactor, or debug an automation already built on Terse. Pulls production run history, analyzes tool usage, prompts, filters, and error handling, then verifies with replay.
license: MIT
metadata:
  author: Terse AI
  version: "0.3.0"
  category: workflow
---

# Improve a Terse Workflow

Improve the Terse workflow named: **$ARGUMENTS**

A workflow is defined in code as a job (`createJob` in `src/terse.jobs.ts`); the CLI commands below take that job name.

## Reference docs

The bundled [sdk-reference.md](references/sdk-reference.md) covers the common path offline. Terse evolves fast, so pull the live docs whenever you reach past what the reference covers or aren't sure it's current:

- Doc index: https://docs.useterse.ai/llms.txt — fetch this first to discover every page available, then pull the specific pages you need (triggers, skills, hosting, observability, etc.).
- CLI reference: https://docs.useterse.ai/reference/cli — authoritative source for every `terse` command, including `history`, `replay`, and `test`.

Precedence: live docs win on facts (API signatures, CLI flags, availability). The bundled [code-conventions.md](references/code-conventions.md) wins on style — how job code is structured.

## Steps

**Do not search or read `node_modules/`.** Everything you need is in `src/terse.jobs.ts`, `src/terse.generated.ts`, the bundled [sdk-reference.md](references/sdk-reference.md), and live Terse docs — not inside dependency install dirs.

`src/terse.generated.ts` is the source of truth for connected integrations, available triggers, skills, resources, and deterministic wrappers. Read it alongside the job implementation. Do not run `terse integrate list` — the generated file already reflects what `terse integrate` connected.

If `src/terse.generated.ts` is missing or stale for the integrations the job uses, rerun `terse generate` instead of guessing at missing helpers. Never edit the generated file directly.

### 1. Find the workflow

Open `src/terse.jobs.ts` and `src/terse.generated.ts`. Find the job matching the requested workflow name and read the full implementation — triggers, skills, filter, and handler.

The CLI can still load `src/index.ts` as a legacy fallback, and custom layouts can override the entry file with `--entry-file`.

### 2. Pull production run history

Before guessing at improvements, look at how the job has actually behaved in production. The `terse history` CLI command fetches past runs from the deployed agent so you can see what went wrong.

Recommended invocations (see https://docs.useterse.ai/reference/cli for the full flag list):

```bash
# Recent runs as JSON, with the trigger event payload for each one (cheap, ideal for this skill)
terse history "<job-name>" --json --triggers --limit 20

# Narrow to failures only
terse history "<job-name>" --json --triggers --status failed,cancelled --limit 20

# Full chat history (model events + trigger event) for a single run — heavier, use when you need to see exactly what the agent decided
terse history --run-id <run-id> --json
```

If a JSON-mode command returns a structured `{ "error": ... }` envelope with `actionRequired: true`, or exits with code `2`, stop and surface the required next step or URL instead of treating it as a code bug.

What to look for:

- **Failed or cancelled runs** — the trigger event shows the input that broke the job.
- **Repeated patterns** — the same kind of event misbehaving suggests a missing filter, a vague prompt, or a missing skill.
- **Wasted runs** — bot events, drafts, or no-op events that should have been filtered out.
- **Agentic overreach** — `generateText` doing deterministic work (`toolbox` would be correct). Check chat history for wrong tool picks or hallucinated parameters.

If the user has not deployed the job yet (no agent found), skip this step and rely on the source code plus sample events from `terse test list`.

### 3. Analyze for improvements

Account for every area below before you finish: for each, either make a change or confirm it's already fine. Don't stop at the first easy win. Start with **Tool usage**, since moving work from the agent to `toolbox` is usually the highest-impact fix.

Read [code-conventions.md](references/code-conventions.md) before this pass — the Conventions and Durability areas audit against it.

#### Tool Usage

- **Known calls vs judgment**: For actions with known parameters, use `toolbox`, not `generateText`. Read available methods in `src/terse.generated.ts`.
- **Unnecessary agents**: If the handler only runs deterministic tools, drop `generateText` entirely and call `toolbox` directly.
- **Prompts doing integration work**: Phrases like "post to Slack", "create a Linear issue", or "add label X" in a prompt usually mean that step should be code. Keep prompts for judgment only (summarize, triage, draft).
- **Skill scoping**: `skills` controls what tools the model can pick during a `generateText` run. `toolbox.<integration>` is unaffected by `skills` — use it when you want a deterministic call without configuring an agent.
- **Multi-step**: Known setup first (`toolbox.slack.sendMessage`), then a narrow `generateText` call for the part that needs judgment, then post the result back with `toolbox`.
- **Tool results**: Capture return values from deterministic calls when later steps need them (e.g. `message.message_ts` for threading).

#### Prompt Quality

- **Specificity**: Does the prompt tell the agent exactly what to do? Vague prompts like "handle this event" waste tokens and produce inconsistent results. Be specific: "Summarize the PR changes in 3 bullet points and post to Slack."
- **Event context**: Does it include the full event payload via `event.formatForAgentRunner()`?
- **Edge cases**: Does the prompt explain what to do when things are ambiguous? E.g., "If the PR has no description, summarize from the diff only."
- **Format instructions**: Does it specify the output format? "Format as Block Kit JSON" vs leaving it open.
- **Length**: Is the prompt too long? Split multi-step instructions into separate agent runs or use deterministic tool calls for the predictable parts.

#### Event Filtering

- **Bot events**: Should bot-generated events be skipped? (`event.sender.login.includes("[bot]")`)
- **Draft/WIP**: Should draft PRs or WIP items be ignored?
- **Specific sources**: Should events from certain users, repos, or channels be filtered?
- **Cost**: Every unfiltered event triggers an agent run. Filters save real money.

#### Error Handling

- **Missing data**: Does the code handle cases where event data might be missing? (e.g., PR with no body, push with no commits) Fail fast with a custom error rather than limping on.
- **Error classes**: Errors are custom classes that `extend Error` and set `this.name` — no ad-hoc string throws or result objects.
- **No nested try/catch**: When a `catch` body needs its own error handling, extract the catch body into a helper function.
- **Prompt resilience**: Does the agent prompt explain what to do if a tool call fails?

#### Conventions

- Audit the job against [code-conventions.md](references/code-conventions.md): stray `as`/`any` casts, inline-ternary dispatch where an exhaustive `switch` belongs, nested try/catch, helper-above-handler ordering, types scattered mid-file, hand-rolled solutions where a popular library exists, missing zod at trust boundaries.
- Report every violation you find. Fix only the ones on code paths you are already changing for this improvement; offer standalone style retrofits as an explicit opt-in.

#### Durability

- **Durable jobs**: every side effect lives inside a step; `step(client.method(args))` for direct calls and `jobStep` at trust boundaries; side-effecting branches extracted into helpers below the job in the same file; only serializable data crosses step boundaries; branch conditions derive from the trigger event or step results.
- **Non-durable jobs**: check for durable signals that have crept in — human approvals, timed waits, or 3+ side-effecting stages where a mid-run crash leaves visible half-done work. If present, recommend flipping `durable: true` (and the step restructuring it requires) as an opt-in improvement.

#### Skill Configuration

- **Missing skills**: Are all integrations the model needs during a `generateText` run listed? If the prompt tells the model to post to Slack but Slack isn't in `skills`, that agentic step will fail.
- **Unnecessary skills**: Are there skills the agent doesn't actually use? Remove them to reduce confusion.
- **Scope**: Are repos/channels/teams scoped correctly? Too broad gives the agent access to things it shouldn't touch. Too narrow prevents it from doing its job.

### 4. Confirm behavior changes with the user

If any proposed improvement changes the job's observable behavior — a filter that skips events it used to process, a rewritten prompt, a changed output surface, a durability flip — put those decisions to the user before implementing. Provide a recommended answer for each, and batch related questions, at most four per interruption. Mechanical fixes (typing, error classes, file shape) don't need confirmation.

If a *fact* can be found in the code, run history, or docs, look it up rather than asking. If you are running headless with no one to answer, take your recommended answers and state them with reasons in the final summary.

### 5. Implement improvements

Edit `src/terse.jobs.ts` (or the repo's configured `--entry-file`). Make the changes following [code-conventions.md](references/code-conventions.md). If you connected a new integration or need updated helpers, rerun `terse generate` and reopen `src/terse.generated.ts` — never edit the generated file by hand.

### 6. Verify the changes locally

Don't hand the change back without proving it still works. Two complementary loops:

**Replay the exact production run that failed.** If you used `terse history` in step 2 to find a bad run, replay it locally with the new code:

```bash
terse replay <run-id>
```

`terse replay` fetches the original serialized trigger event from the Terse backend and runs your job's `onTrigger` against it locally with verbose agent output. This is the fastest way to confirm the bug you saw in production is actually fixed.

**Or run against fresh sample events non-interactively.** When there is no specific run to reproduce, or to make sure you didn't regress the happy path:

```bash
terse test list "<job-name>" --json
terse test show <id> "<job-name>" --json
terse test run "<job-name>" --id <id>
```

`terse test list` pulls real sample events from the backend (or generates synthetic ones for cron and webhook triggers) and assigns content-addressed ids.
`terse test show` lets you inspect a specific cached sample before running it.
`terse test run` executes the handler without requiring a TTY.

If multiple jobs exist, pass the job name explicitly because non-interactive job loading cannot prompt.
Reserve bare `terse test` for manual interactive sessions only.

For all of these commands, see https://docs.useterse.ai/reference/cli for the full option list.

### 7. Typecheck the project

After local execution looks healthy, run the typechecker so the change is statically valid before deploy:

```bash
pnpm exec tsc --noEmit
```

Use `npx tsc --noEmit` or `pnpm run build` if that matches how the project is set up. Fix any errors before reporting back.

### 8. Explain changes

After implementing and verifying, summarize what you changed and why. Where it helps, cite the production runs from `terse history` that motivated each change and note which `terse replay` / `terse test list/show/run` invocations confirmed the fix.

### 9. Ask before deploying

Do not run `terse deploy` automatically. After explaining the changes, ask the user whether to deploy them now.

If you changed the step structure of a deployed **durable** job (added, removed, or reordered steps), warn the user in the same ask: in-flight runs will resume against a changed journal and can fail or misbehave, so deploy at a quiet moment.

Example prompt:

> The improvements are verified locally. Deploy to production with `terse deploy`? (This syncs all jobs in the project — removed jobs are deleted remotely.)

- If the user says yes, run `terse deploy` and report the outcome.
- If the user says no or wants more changes, stop without deploying and remind them they can run `terse deploy` when ready.

## Common Improvement Patterns

### Add bot filtering
```typescript
// BEFORE: runs on every event
onTrigger: async (event) => { ... }

// AFTER: skip bot events
filter: async (event: GithubPRTrigger) => {
    return !event.sender.login.includes("[bot]") && !event.pullRequest.merged
},
onTrigger: async (event: GithubPRTrigger) => { ... }
```

### Improve prompt specificity
```typescript
// BEFORE: vague
await generateText({ prompt: `Review this PR: ${event.formatForAgentRunner()}`, skills: [...] })

// AFTER: specific instructions, format, edge cases
await generateText({
    prompt:
        `Review PR "${event.pullRequest.title}" (${event.pullRequest.url}). ` +
        `Look at the diff and leave a concise review comment. ` +
        `Focus on: correctness, edge cases, and naming. ` +
        `Skip style nits. If the PR looks good, approve it with a short note. ` +
        `Context: ${event.formatForAgentRunner()}`,
    skills: [...],
})
```

### Split deterministic + AI actions
```typescript
// BEFORE: agent decides everything including the message send
await generateText({ prompt: `Send a welcome message and summarize: ${event.formatForAgentRunner()}`, skills: [...] })

// AFTER: deterministic send via toolbox (no skill needed), then AI analysis in thread
import { generateText } from "terse-sdk"
import { toolbox } from "./terse.generated"

const message = await toolbox.slack.sendMessage({
    channelId: SlackChannel.Engineering.channelId,
    message: `New PR from ${event.sender.login}: ${event.pullRequest.title}`,
    thread_ts: "",
    blocks: "",
})

const summary = await generateText({
    prompt: `Summarize the changes in this PR. Context: ${event.formatForAgentRunner()}`,
    skills: [Skills.github({ repos: [Repos.MyOrg.MyRepo] })],
})

await toolbox.slack.sendMessage({
    channelId: SlackChannel.Engineering.channelId,
    message: summary,
    thread_ts: message.message_ts,
    blocks: "",
})
```

### Add type safety
```typescript
// BEFORE: untyped event
onTrigger: async (event) => {
    await generateText({ prompt: `Handle: ${event.formatForAgentRunner()}`, skills: [...] })
}

// AFTER: annotate with the precise trigger type that matches your trigger factory.
// `Triggers.github.onPROpened(...)` returns a typed trigger, so `event` infers
// as `GithubPROpenedTrigger` — annotating just makes it explicit.
import { GithubPROpenedTrigger, generateText } from "terse-sdk"

onTrigger: async (event: GithubPROpenedTrigger) => {
    const { title, url } = event.pullRequest
    await generateText({
        prompt: `Review PR "${title}" at ${url}. Context: ${event.formatForAgentRunner()}`,
        skills: [...],
    })
}
```
