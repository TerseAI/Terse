# terse-sdk

TypeScript SDK for building workflows on the [Terse](https://useterse.ai) platform.

Terse is a code-first AI workflow platform. You write workflows in TypeScript, mix deterministic tool calls with agentic loops, and deploy serverlessly. Full docs at [docs.useterse.ai](https://docs.useterse.ai).

## Install

```bash
npm install terse-sdk zod
```

`zod` is used for structured output schemas.

The fastest way to get started is `npm install -g terse-cli && terse init my-project`. The CLI scaffolds the project, installs `terse-sdk`, and generates `src/terse.generated.ts` for you. See the [quickstart](https://docs.useterse.ai/quickstart).

## Example

A Terse workflow is a single TypeScript file. The job below watches a repo for new pull requests, posts a deterministic Slack message, then threads an agent-written summary under it:

```ts
import { GithubPRTrigger, TerseAgent, createJob } from "terse-sdk"
import { Repos, Skills, SlackChannel, Triggers } from "../terse.generated"
// ^^ Generated based on your workspace

createJob({
    name: "Summarize PR and send slack message",
    triggers: [Triggers.github.onPROpened({ repo: Repos.TerseAI.Terse })],
    onTrigger: async (event: GithubPRTrigger) => {
        // Create durable Agents
        const prompt = "Summarize the incoming PR and send to slack. Format the summary in Block Kit; include screenshots or diagrams from the PR as image blocks."
        const agent = TerseAgent.create({
            prompt,
            skills: [
                // Fine tune what agents have access to. Impossible to modify anything outside of this scope
                Skills.github({ repos: [Repos.TerseAI.Terse] }),
                Skills.slack({ channel: SlackChannel.AllTerseInc })
            ]
        })

        // deterministically call a tool
        const message = await agent.tools.slack.sendMessage({
            channelId: SlackChannel.AllTerseInc.channelId,
            message: "New PR from " + event.sender.login + "!"
        })

        // Outputs are strongly typed
        const parentId = message.message_ts

        // Trigger the Agent with Github + Slack tools auto added
        await agent.runAndWait(`
        Summarize this PR ${event.formatForAgentRunner()}.
        Keep it short. Reply in a thread to the Slack message (thread parent ts: ${parentId}).
        `)
    }
})
```

## Core concepts

| Concept | What it is |
|---|---|
| `createJob()` | Registers a workflow at module load time. |
| `TerseAgent.create()` | Build an agent inside `onTrigger` with `prompt`, `skills`, and `toolApprovals`. |
| `agent.run()` | Stream the model run as an async iterable. |
| `agent.runAndWait()` | Run to completion. Pass a `zod` schema for structured output. |
| `agent.tools.*` | Generated, deterministic wrappers. Call directly to bypass the LLM. |
| `Triggers.*` | Per-integration trigger builders, plus `Triggers.schedule.cron()` and `Triggers.webhook.onRequest<Body>()`. |
| `Skills.*` | Integration skill factories (e.g. `Skills.github({...})`, `Skills.slack({...})`) that scope the tools available to the agent. |

The trigger builders, skill constructors, and `agent.tools.*` wrappers come from `src/terse.generated.ts`, which is produced by `terse generate`. Do not edit it by hand.

Full reference: [docs.useterse.ai/reference/typescript-sdk](https://docs.useterse.ai/reference/typescript-sdk).

## Environment

| Variable | Description |
|---|---|
| `TERSE_API_KEY` | Required at runtime. The CLI also stores a key per user via `terse login`. |
