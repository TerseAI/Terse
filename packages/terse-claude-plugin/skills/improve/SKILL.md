---
name: improve
description: Improve an existing Terse SDK job. Use when the user wants to optimize, fix, refactor, or enhance an automation — better prompts, smarter filtering, type safety, error handling, or tool usage.
argument-hint: <job-name>
---

# Improve a Terse Job

Improve the Terse job named: **$ARGUMENTS**

For complete SDK reference (triggers, skills, events, TerseAgent API), see [sdk-reference.md](reference/sdk-reference.md).

## Steps

### 1. Detect the project language and find the job

Use project markers to detect the language:

- TypeScript: `package.json` and `src/index.ts`
- Python: `pyproject.toml` and `src/main.py`

Then open the right files:

- TypeScript: `src/index.ts` and `src/terse.generated.ts`
- Python: `src/main.py` and `src/terse_generated.py`

Find the job matching the requested name and read the full implementation — triggers, skills, filter, and handler.
If the generated file is missing or stale for the requested integration, rerun `terse generate` instead of guessing at missing helpers.

### 2. Analyze for improvements

Evaluate each area below. Not every area will need changes — focus on the ones that make the biggest difference.

#### Prompt Quality

- **Specificity**: Does the prompt tell the agent exactly what to do? Vague prompts like "handle this event" waste tokens and produce inconsistent results. Be specific: "Summarize the PR changes in 3 bullet points and post to Slack."
- **Event context**: Does it include the full event payload?
TypeScript: `event.formatForAgentRunner()`
Python: `event.formatted_content`
- **Edge cases**: Does the prompt explain what to do when things are ambiguous? E.g., "If the PR has no description, summarize from the diff only."
- **Format instructions**: Does it specify the output format? "Format as Block Kit JSON" vs leaving it open.
- **Length**: Is the prompt too long? Split multi-step instructions into separate agent runs or use deterministic tool calls for the predictable parts.

#### Event Filtering

- **Bot events**: Should bot-generated events be skipped? (`event.sender.login.includes("[bot]")`)
- **Draft/WIP**: Should draft PRs or WIP items be ignored?
- **Specific sources**: Should events from certain users, repos, or channels be filtered?
- **Cost**: Every unfiltered event triggers an agent run. Filters save real money.

#### Type Safety and language fit

- **Event type**: Is the event typed with the correct class for the language? Use `GithubPRTrigger` in TypeScript, or the matching `terse_sdk` event class in Python.
- **Type guards**: When handling events from multiple trigger types, use `isGithubPRTrigger()`, `isGithubPushTrigger()`, etc.
- **Imports**: Are trigger and skill types imported from the correct generated file?
- **Method names**: Does the code use the right runtime API for the language? TypeScript uses `runAndWait()` / `executeTool()`. Python uses `run_and_wait()` / `execute_tool()`.
- **Python generated surface**: If the project is Python, are you only using helpers that actually exist in `src/terse_generated.py`?

#### Tool Usage

- **Deterministic vs AI**: For actions with known parameters, prefer generated deterministic wrappers over an agent run. Use `Agent.tools.*` / `Agent.executeTool()` in TypeScript, or `agent.tools.*` / `agent.execute_tool()` in Python when the helper exists.
- **Multi-step**: Could a two-step approach work better? E.g., send a Slack message first with `Agent.tools.slack.sendMessage()`, then use `Agent.runAndWait()` to post an AI-generated summary as a thread reply.
- **Tool results**: When using `Agent.tools.*`, capture the return value if subsequent steps need it (e.g., `message.message_ts` for threading).

#### Error Handling

- **Missing data**: Does the code handle cases where event data might be missing? (e.g., PR with no body, push with no commits)
- **Try/catch**: Are there try/catch blocks around critical tool calls?
- **Prompt resilience**: Does the agent prompt explain what to do if a tool call fails?

#### Skill Configuration

- **Missing skills**: Are all needed integrations listed? If the prompt tells the agent to post to Slack but Slack isn't in `skills`, it will fail.
- **Unnecessary skills**: Are there skills the agent doesn't actually use? Remove them to reduce confusion.
- **Scope**: Are repos/channels/teams scoped correctly? Too broad gives the agent access to things it shouldn't touch. Too narrow prevents it from doing its job.

### 3. Implement improvements

Edit the language-specific entry file directly. Make the changes. Never edit the generated file by hand; rerun `terse generate` if the helper surface needs to change.

### 4. Explain changes

After implementing, summarize what you changed and why.

## Common Improvement Patterns

The examples below are in TypeScript. Apply the same reasoning in Python projects using `src/main.py`, `terse_sdk`, `terse_generated`, snake_case method names, and `event.formatted_content`. Only use helpers that actually exist in `src/terse_generated.py`.

### Add bot filtering
```typescript
// BEFORE: runs on every event
onTrigger: async (event, Agent) => { ... }

// AFTER: skip bot events
filter: async (event: GithubPRTrigger) => {
    return !event.sender.login.includes("[bot]") && !event.pullRequest.merged
},
onTrigger: async (event: GithubPRTrigger, Agent: TerseAgent) => { ... }
```

### Improve prompt specificity
```typescript
// BEFORE: vague
await Agent.runAndWait(`Review this PR: ${event.formatForAgentRunner()}`)

// AFTER: specific instructions, format, edge cases
await Agent.runAndWait(
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
await Agent.runAndWait(`Send a welcome message and summarize: ${event.formatForAgentRunner()}`)

// AFTER: deterministic send, then AI analysis in thread
const message = await Agent.tools.slack.sendMessage({
    channelId: SlackChannel.Engineering.channelId,
    message: `New PR from ${event.sender.login}: ${event.pullRequest.title}`,
    thread_ts: "",
    blocks: "",
})

await Agent.runAndWait(
    `Summarize the changes in this PR and post as a thread reply ` +
    `(thread_ts: ${message.message_ts}). ` +
    `Context: ${event.formatForAgentRunner()}`
)
```

### Add type safety
```typescript
// BEFORE: untyped event
onTrigger: async (event, Agent) => {
    await Agent.runAndWait(`Handle: ${event.formatForAgentRunner()}`)
}

// AFTER: typed event with type guard
import { GithubPRTrigger, isGithubPRTrigger } from "terse-sdk"

onTrigger: async (event: GithubPRTrigger, Agent: TerseAgent) => {
    if (!isGithubPRTrigger(event)) return
    const { title, url } = event.pullRequest
    await Agent.runAndWait(
        `Review PR "${title}" at ${url}. Context: ${event.formatForAgentRunner()}`
    )
}
```
