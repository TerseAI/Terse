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

What `terse init` scaffolds in `src/terse.jobs.ts`:

```ts
import { createJob, TerseAgent } from "terse-sdk"
import { z } from "zod"

import { Triggers } from "./terse.generated"

createJob({
    name: "Tell a programming joke example job",
    triggers: [Triggers.schedule.cron({ expression: "0 9 * * 1" })],
    onTrigger: async (event) => {
        const agent = TerseAgent.create({
            prompt: "You are a helpful assistant that tells programming jokes.",
            skills: []
        })

        const response = await agent.runAndWait("Tell me a programming joke.", z.object({
            joke: z.string()
        }))

        console.log(response.joke)
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
