---
name: create
description: Create a new Terse SDK job. Use when the user wants to build a new automation, agent, or job that reacts to events (GitHub PRs, Slack messages, Linear issues, cron schedules, etc.) and takes actions.
argument-hint: <job-description>
---

# Create a Terse Job

Create a new Terse SDK job based on: **$ARGUMENTS**

For complete SDK reference (triggers, skills, events, TerseAgent API), see [sdk-reference.md](reference/sdk-reference.md).

## Steps

### 1. Read the generated types

Open `src/terse.generated.ts` to see which integrations are connected and what repos, channels, teams, and other resources are available.

If the file doesn't exist, tell the user to run `terse generate` first.

### 2. Open the entry file

Open `src/index.ts`. If it already has jobs, add the new one below them. If no `Terse` client exists yet, create one:

```typescript
import { Terse, TerseAgent } from "terse-sdk"
const client = new Terse()
```

### 3. Pick triggers

Choose triggers based on what events the job should respond to. Import trigger factories and resource constants from `./terse.generated`.

Only use triggers and resources that actually exist in `terse.generated.ts`. Do not invent constants that aren't defined there.

### 4. Pick skills

Add skill configs for every integration the agent needs to act on. The agent cannot use tools for services not listed in `skills`. Include all services mentioned in the user's request plus any the agent will need to complete its task.

### 5. Consider a filter

Add a `filter` function if the job should skip certain events:
- Bot-generated events (`event.sender.login.includes("[bot]")`)
- Draft PRs, WIP items, or specific labels
- Events from specific users or repos

Filters prevent unnecessary agent runs and save cost.

### 6. Write the onTrigger handler

Use the appropriate event type from the SDK (e.g., `GithubPRInputEvent`, `WorkOSUserInputEvent`).

**Always** include `event.formatForAgentRunner()` in your prompt to give the agent full event context.

Choose the right approach for the handler:
- **AI decision-making** (summarize, triage, analyze): `Agent.runAndWait(prompt)`
- **Deterministic actions** (send a specific message, create a fixed issue): `Agent.tools.*` or `Agent.executeTool()`
- **Combined**: Do a deterministic action first, then pass the result into an agent prompt

Write clear, specific prompts. Tell the agent exactly what to do and what format to use. Avoid vague instructions like "handle this event."

### 7. Final check

Verify:
- All imports reference actual exports from `terse-sdk` and `./terse.generated`
- The job `name` is unique and descriptive
- Every integration the agent needs is in `skills`
- The event type in `onTrigger` matches the trigger type
- The prompt includes `event.formatForAgentRunner()`

## Example

```typescript
import { Terse, TerseAgent, GithubPRInputEvent } from "terse-sdk"
import { GitHub, Slack, Repos, SlackChannel } from "./terse.generated"

const client = new Terse()

await client.createJob({
    name: "Summarize PR and notify Slack",
    triggers: [GitHub.onPROpened({ repo: Repos.MyOrg.MyRepo })],
    skills: [
        GitHub.skill({ repos: [Repos.MyOrg.MyRepo] }),
        Slack.skill({ channel: SlackChannel.Engineering }),
    ],
    filter: async (event: GithubPRInputEvent) => {
        return !event.sender.login.includes("[bot]")
    },
    onTrigger: async (event: GithubPRInputEvent, Agent: TerseAgent) => {
        const message = await Agent.tools.slack.sendMessage({
            channelId: SlackChannel.Engineering.channelId,
            message: `New PR from ${event.sender.login}: ${event.pullRequest.title}`,
            thread_ts: "",
            blocks: "",
        })

        await Agent.runAndWait(
            `Summarize the changes in this PR and post as a thread reply ` +
            `(thread_ts: ${message.message_ts}). ` +
            `Focus on what changed, why it matters, and what reviewers should look at first. ` +
            `Keep it concise. Context: ${event.formatForAgentRunner()}`
        )
    },
})
```
