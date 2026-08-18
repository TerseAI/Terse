# terse-sdk

TypeScript SDK for building workflows on the [Terse](https://useterse.ai) platform.

Terse is the AI workflow platform for coding agents. You write workflows in TypeScript, mix deterministic tool calls with agentic loops, and deploy serverlessly. Full docs at [docs.useterse.ai](https://docs.useterse.ai).

## Install

```bash
npm install terse-sdk zod
```

`zod` is used for structured output schemas.

The fastest way to get started is `npm install -g terse-cli && terse init my-project`. The CLI scaffolds the project, installs `terse-sdk`, and generates `src/terse.generated.ts` for you. See the [quickstart](https://docs.useterse.ai/quickstart).

## Example

A Terse workflow is a single TypeScript file. The job below watches a repo for new pull requests, posts a deterministic Slack message, then threads an agent-written summary under it:

```ts
import { GithubPRTrigger, generateText, createJob } from "terse-sdk"
import { Repos, Skills, SlackChannel, Triggers, toolbox } from "../terse.generated"
// ^^ Generated based on your workspace

createJob({
    name: "Summarize PR and send slack message",
    triggers: [Triggers.github.onPROpened({ repo: Repos.TerseAI.Terse })],
    onTrigger: async (event: GithubPRTrigger) => {
        // Deterministic call — fixed channel, fixed message. No agent needed.
        const message = await toolbox.slack.sendMessage({
            channelId: SlackChannel.AllTerseInc.channelId,
            message: "New PR from " + event.sender.login + "!"
        })

        // Outputs are strongly typed
        const parentId = message.message_ts

        // Agentic: one prompt in, the model uses the GitHub + Slack tools granted via skills
        await generateText({
            prompt: `
            Summarize this PR ${event.formatForAgentRunner()}.
            Keep it short. Format the summary in Block Kit; include screenshots or diagrams from the PR as image blocks.
            Reply in a thread to the Slack message (thread parent ts: ${parentId}).
            `,
            skills: [
                // Fine tune what the agent has access to. Impossible to touch anything outside this scope
                Skills.github({ repos: [Repos.TerseAI.Terse] }),
                Skills.slack({ channel: SlackChannel.AllTerseInc })
            ]
        })
    }
})
```

## Core concepts

| Concept | What it is |
|---|---|
| `createJob()` | Registers a workflow at module load time. |
| `generateText()` | The shorthand for agentic runs: one prompt in, final output out. The model can call any tool granted via `skills`. Pass a `zod` `outputSchema` for structured output. Reach for this in almost every job. |
| `toolbox.*` | Generated, deterministic wrappers. Call directly to bypass the LLM. No agent or `skills` needed. |
| `Triggers.*` | Per-integration trigger builders, plus `Triggers.schedule.cron()` and `Triggers.webhook.onRequest<Body>()`. |
| `Skills.*` | Integration skill factories (e.g. `Skills.github({...})`, `Skills.slack({...})`) that scope the tools available to the model. |
| `TerseAgent.create()` | The lower-level agent `generateText` wraps. Use directly only to stream with `run()` or reuse one agent instance across calls. |

The trigger builders, skill constructors, and `toolbox.*` wrappers come from `src/terse.generated.ts`, which is produced by `terse generate`. Do not edit it by hand.

Full reference: [docs.useterse.ai/reference/typescript-sdk](https://docs.useterse.ai/reference/typescript-sdk).

## Environment

| Variable | Description |
|---|---|
| `TERSE_PROJECT_KEY` | Required at runtime. The control plane injects it into Terse Cloud sandboxes; on a self-hosted data plane, `terse attach` prints one to put in your server's environment. |
| `TERSE_API_KEY` | Your user token, used by the CLI. Stored per user by `terse login`. Local runs fall back to it when no project key is set. |
