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

Use project markers to detect the language:

- TypeScript: `package.json` and `src/index.ts`

These are the same markers the `terse` CLI uses after `terse init`.

Then open the generated file for that language:

- TypeScript: `src/terse.generated.ts`

If the generated file doesn't exist, tell the user to run `terse generate` first.
If it exists but does not expose the helper the user expects, rerun `terse generate` before inventing anything.

### 2. Open the entry file

Open the language-specific entry file:

- TypeScript: `src/index.ts`

If it already has jobs, add the new one below them.
Never edit the generated file directly.

If no runtime entry exists yet, create one for the current language:

```typescript
import { createJob, TerseAgent } from "terse-sdk"
```

### 3. Pick triggers

Choose triggers based on what events the job should respond to. Import trigger factories and resource constants from the generated file for the current language.

Only use triggers and resources that actually exist in the generated file. Do not invent constants that are not defined there.

### 4. Pick skills

Add skill configs for every integration the agent needs to act on. The agent cannot use tools for services not listed in `skills`. Include all services mentioned in the user's request plus any the agent will need to complete its task.

The helper surface is language-specific. The CLI supports multiple languages, but it does not guarantee the same generated integrations in both.

### 5. Consider a filter

Add a `filter` function if the job should skip certain events:
- Bot-generated events (`event.sender.login.includes("[bot]")`)
- Draft PRs, WIP items, or specific labels
- Events from specific users or repos

Filters prevent unnecessary agent runs and save cost.

### 6. Write the onTrigger handler

Use the appropriate event type from the SDK for the current language.

**Always** include the full event context in your prompt:

- TypeScript: `event.formatForAgentRunner()`

Choose the right approach for the handler:
- **AI decision-making**
TypeScript: `Agent.runAndWait(prompt, event)`
- **Deterministic actions**
TypeScript: `Agent.tools.*` or `Agent.executeTool()`
- **Combined**: Do a deterministic action first, then pass the result into an agent prompt

Write clear, specific prompts. Tell the agent exactly what to do and what format to use. Avoid vague instructions like "handle this event."

### 7. Final check

Verify:
- TypeScript imports reference actual exports from `terse-sdk` and `./terse.generated`
- The job `name` is unique and descriptive
- Every integration the agent needs is in `skills`
- The event type in `onTrigger` matches the trigger type
- The prompt includes full event context for the language

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
