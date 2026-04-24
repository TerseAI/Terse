---
name: improve
description: Improve an existing Terse SDK job. Use when the user wants to optimize, fix, refactor, or enhance an automation — better prompts, smarter filtering, type safety, error handling, or tool usage.
argument-hint: <job-name>
---

# Improve a Terse Job

Improve the Terse job named: **$ARGUMENTS**

## Reference docs

The bundled [sdk-reference.md](reference/sdk-reference.md) is a quick offline cheat sheet, but Terse evolves fast. Always pull the live docs before making non-trivial changes:

- Doc index: https://docs.useterse.ai/llms.txt — fetch this first to discover every page available, then pull the specific pages you need (triggers, skills, hosting, observability, etc.).
- CLI reference: https://docs.useterse.ai/reference/cli — authoritative source for every `terse` command, including `history`, `replay`, and `test`.

If anything in the bundled reference disagrees with the live docs, trust the live docs.

## Steps

### 1. Detect the project language and find the job

Use project markers to detect the language:

- TypeScript: `package.json` and `tsconfig.json`

Then open the right files:

- TypeScript: `src/terse.jobs.ts` and `src/terse.generated.ts`

Find the job matching the requested name and read the full implementation — triggers, skills, filter, and handler.
The CLI can still load `src/index.ts` as a legacy fallback, and custom layouts can override the entry file with `--entry-file`.
If the generated file is missing or stale for the requested integration, rerun `terse generate` instead of guessing at missing helpers.

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
- **Wrong tool choices** — the agent reaching for `runAndWait` when a deterministic `agent.tools.*` call would have been correct (or vice versa).

If the user has not deployed the job yet (no agent found), skip this step and rely on the source code plus sample events from `terse test list`.

### 3. Analyze for improvements

Evaluate each area below. Not every area will need changes — focus on the ones that make the biggest difference.

#### Prompt Quality

- **Specificity**: Does the prompt tell the agent exactly what to do? Vague prompts like "handle this event" waste tokens and produce inconsistent results. Be specific: "Summarize the PR changes in 3 bullet points and post to Slack."
- **Event context**: Does it include the full event payload?
TypeScript: `event.formatForAgentRunner()`
- **Edge cases**: Does the prompt explain what to do when things are ambiguous? E.g., "If the PR has no description, summarize from the diff only."
- **Format instructions**: Does it specify the output format? "Format as Block Kit JSON" vs leaving it open.
- **Length**: Is the prompt too long? Split multi-step instructions into separate agent runs or use deterministic tool calls for the predictable parts.

#### Event Filtering

- **Bot events**: Should bot-generated events be skipped? (`event.sender.login.includes("[bot]")`)
- **Draft/WIP**: Should draft PRs or WIP items be ignored?
- **Specific sources**: Should events from certain users, repos, or channels be filtered?
- **Cost**: Every unfiltered event triggers an agent run. Filters save real money.

#### Tool Usage

- **Deterministic vs AI**: For actions with known parameters, prefer generated deterministic wrappers over an agent run. Use `agent.tools.*` / `agent.executeTool()` in TypeScript.
- **Model access vs code access**: Missing entries in `skills` break model-driven tool use inside `run()` / `runAndWait()`, but they do not automatically prevent direct deterministic calls from code.
- **Multi-step**: Could a two-step approach work better? E.g., send a Slack message first with `agent.tools.slack.sendMessage()`, then use `agent.runAndWait()` to post an AI-generated summary as a thread reply.
- **Tool results**: When using `agent.tools.*`, capture the return value if subsequent steps need it (e.g., `message.message_ts` for threading).

#### Error Handling

- **Missing data**: Does the code handle cases where event data might be missing? (e.g., PR with no body, push with no commits)
- **Try/catch**: Are there try/catch blocks around critical tool calls?
- **Prompt resilience**: Does the agent prompt explain what to do if a tool call fails?

#### Skill Configuration

- **Missing skills**: Are all integrations the model needs during `run()` / `runAndWait()` listed? If the prompt tells the model to post to Slack but Slack isn't in `skills`, that agentic step will fail.
- **Unnecessary skills**: Are there skills the agent doesn't actually use? Remove them to reduce confusion.
- **Scope**: Are repos/channels/teams scoped correctly? Too broad gives the agent access to things it shouldn't touch. Too narrow prevents it from doing its job.

### 4. Implement improvements

Edit the language-specific entry file directly. Make the changes. Never edit the generated file by hand; rerun `terse generate` if the helper surface needs to change.

### 5. Verify the changes locally

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

### 6. Typecheck the project

After local execution looks healthy, run the project's typechecker so the change is statically valid before deploy:

- TypeScript: `pnpm exec tsc --noEmit` (or `npx tsc --noEmit`, or `pnpm run build` if the scaffolded `build` script is unchanged).

Fix any errors before reporting back. If the project uses a different typechecker (mypy, pyright, etc.), use whatever the repo is configured for.

### 7. Explain changes

After implementing and verifying, summarize what you changed and why. Where it helps, cite the production runs from `terse history` that motivated each change and note which `terse replay` / `terse test list/show/run` invocations confirmed the fix.

## Common Improvement Patterns

### Add bot filtering
```typescript
// BEFORE: runs on every event
onTrigger: async (event, agent: TerseAgent) => { ... }

// AFTER: skip bot events
filter: async (event: GithubPRTrigger) => {
    return !event.sender.login.includes("[bot]") && !event.pullRequest.merged
},
onTrigger: async (event: GithubPRTrigger, agent: TerseAgent) => { ... }
```

### Improve prompt specificity
```typescript
// BEFORE: vague
await agent.runAndWait(`Review this PR: ${event.formatForAgentRunner()}`)

// AFTER: specific instructions, format, edge cases
await agent.runAndWait(
    `Review PR "${event.pullRequest.title}" (${event.pullRequest.url}). ` +
    `Look at the diff and leave a concise review comment. ` +
    `Focus on: correctness, edge cases, and naming. ` +
    `Skip style nits. If the PR looks good, approve it with a short note. ` +
    `Context: ${event.formatForAgentRunner()}`
)
```

### Split deterministic + AI actions
```typescript
// BEFORE: agent decides everything including the message send
await agent.runAndWait(`Send a welcome message and summarize: ${event.formatForAgentRunner()}`)

// AFTER: deterministic send, then AI analysis in thread
const message = await agent.tools.slack.sendMessage({
    channelId: SlackChannel.Engineering.channelId,
    message: `New PR from ${event.sender.login}: ${event.pullRequest.title}`,
    thread_ts: "",
    blocks: "",
})

await agent.runAndWait(
    `Summarize the changes in this PR and post as a thread reply ` +
    `(thread_ts: ${message.message_ts}). ` +
    `Context: ${event.formatForAgentRunner()}`
)
```

### Add type safety
```typescript
// BEFORE: untyped event
onTrigger: async (event, agent: TerseAgent) => {
    await agent.runAndWait(`Handle: ${event.formatForAgentRunner()}`)
}

// AFTER: typed event with type guard
import { GithubPRTrigger, isGithubPRTrigger } from "terse-sdk"

onTrigger: async (event: GithubPRTrigger, agent: TerseAgent) => {
    if (!isGithubPRTrigger(event)) return
    const { title, url } = event.pullRequest
    await agent.runAndWait(
        `Review PR "${title}" at ${url}. Context: ${event.formatForAgentRunner()}`
    )
}
```
