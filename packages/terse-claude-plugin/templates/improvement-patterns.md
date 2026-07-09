# Common Improvement Patterns

Before/after shapes for the fixes the analysis pass most often lands on. Method and constant names come from the project's `src/terse.generated.ts`; never invent them.

## Add bot filtering

```typescript
// BEFORE: runs on every event
onTrigger: async (event) => { ... }

// AFTER: skip bot events
filter: async (event: GithubPRTrigger) => {
    return !event.sender.login.includes("[bot]") && !event.pullRequest.merged
},
onTrigger: async (event: GithubPRTrigger) => { ... }
```

## Improve prompt specificity

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

## Split deterministic + AI actions

```typescript
// BEFORE: agent decides everything including the message send
await generateText({ prompt: `Send a welcome message and summarize: ${event.formatForAgentRunner()}`, skills: [...] })

// AFTER: deterministic send via toolbox (no skill needed), then AI analysis in thread
import { generateText } from "terse-sdk"
import { toolbox } from "./terse.generated"

const message = await toolbox.slack.sendMessage({
    channelId: SlackChannel.Engineering.channelId,
    message: `New PR from ${event.sender.login}: ${event.pullRequest.title}`,
})

const summary = await generateText({
    prompt: `Summarize the changes in this PR. Context: ${event.formatForAgentRunner()}`,
    skills: [Skills.github({ repos: [Repos.MyOrg.MyRepo] })],
})

await toolbox.slack.sendMessage({
    channelId: SlackChannel.Engineering.channelId,
    message: summary,
    thread_ts: message.thread_ts,
})
```

## Add type safety

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
