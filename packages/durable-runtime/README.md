# `@terse/durable`

This is an extremely light-weight, malleable, runtime and storage agnostic, Durable Workflow runtime.

This project was build entirely with the TDD + AI approach. Everything started with tests, and everything is heavily unit tested.

# Why Does this Exist?

I built this because I wanted to run durable functions on Sandboxes. This meant coupling the state of the filesystem with the durable journal.

Existing solutions were super heavy-weight and made assumptions on how the workflows were being hosted. For example, most Durable Workflow systems assume you run everything on a small number of nodes and assume each invocation is non-isolated.

This is not the case for running durability in a serverless/cloud function environment.

So I made this!

Some key features:

- Insanely lightweight: The only dependencies are ulid, ms, and zod
- Storage agnostic: Journal can be Postgres, File System, Durable Object etc...
- Runtime agnostic: Runs anywhere you can import this npm package
- Type safety: Type safety enforced everywhere with Zod enforcing serialization safety in the Journal interactions.

```ts
import { FileJournalStore, Runtime, defineWorkflow, sleep, step } from "@terse/durable"
import { z } from "zod"

// 1 line runtime init
const runtime = new Runtime({ journalStore: new FileJournalStore("./tmp") })

// Build your workflow
const WelcomeWorkflow = defineWorkflow({
    name: "welcome-customer",
    input: z.object({
        recipient: z.string(),
        name: z.string()
    }),
    run: async input => {
        const message = await step({
            name: "prepare-message",
            input: {
                name: input.name
            },
            run: async ({ name }) => {
                return `Welcome, ${name}!`
            }
        })

        await sleep("1 day")

        await step({
            name: "send-message",
            input: {
                recipient: input.recipient,
                message
            },
            run: async ({ recipient, message }) => {
                return { delivered: true }
            }
        })
    }
})

// run it
const outcome = await runtime.start(WelcomeWorkflow, {
    runId: "run-123",
    input: {
        // this is type safe!
        recipient: "ada@example.com",
        name: "Ada"
    }
})

if (outcome.status === "completed") {
    console.log("Workflow completed")
} else {
    // reach out to control plane here. Schedule the time to resume the workflow. Use whatever logic you want here!
    console.log("Workflow suspended", outcome.suspension)
}
```

This is the bare bones of a durable runtime. From here, you can chose where to store the journal by simply implementing an interface and plugging it in. (See fileJournalStore.ts for an example implementation)

```ts
export interface JournalStore {
    list(params: ListJournalEventsParams): Promise<readonly JournalEvent[]>
    listByType(params: ListJournalEventsByTypeParams): Promise<readonly JournalEvent[]>
    get(params: GetJournalEventParams): Promise<JournalEvent | undefined>
    append(params: AppendJournalEventParams): Promise<JournalEvent>
}
```

It doesn't care where you run it! Run it on a few nodes like Temporal, run it on Workers, sandboxes etc..

We make it really easy to plug into an external control plane

```ts
// Control plane reaches out via HTTP, Grpc, CLI etc...
const input = req.input
const runId = req.runId
const workflowName = req.workflowName

// resolve workflow, your code here
const workflow = fetchWorkflow(workflowName)

// Start a workflow
const outcome = await runtime.start(workflow, {
    runId,
    input: {
        // this is type safe!
        recipient: "ada@example.com",
        name: "Ada"
    }
})

// Resume from a sleep
const waitId = req.waitId

const resumedOutcome = await runtime.resumeTimer(workflow, {
    runId,
    waitId
})
```

The hook system is also extremely malleable. Very easy to add Slack/email Human in the loop steps and plug into an integration system like Composio.

```ts
const ApprovalHook = defineHook({
    name: "approval",
    request: z.object({
        message: z.string()
    }).strict(),
    resolution: z.object({
        approved: z.boolean(),
        approvedBy: z.string()
    }).strict()
})


const WelcomeWorkflow = defineWorkflow({
    name: "welcome-customer",
    input: z.object({
        recipient: z.string(),
        name: z.string()
    }),
    run: async input => {
        console.log("Pre approval")

        const approved = await waitFor(ApprovalHook, { // Type will match resolution zod object above!
            message: "Deploy to production?"
        })

        console.log("Post approval: They said: {approved}")
    }
})

const outcome = await runtime.start(WelcomeWorkflow, {
    runId: "run-123",
    input: {
        recipient: "ada@example.com",
        name: "Ada"
    }
})

if (outcome.status === "suspended") {
    await runtime.resumeHook(ApprovalHook, {
        workflow: WelcomeWorkflow,
        runId: "run-123",
        waitId: outcome.suspension.waitId,
        resolution: {
            approved: true,
            approvedBy: "Ada"
        }
    })
}

```

In fact, we implement `sleep()` with a small wrapper around defineHook(). A good example to check if you want some more custom hooks.

At Terse, we use this internally to power our Durable functions. We use the `FileJournalStore` to store the journal on the filesystem. On sandbox suspension, it gets picked up on the snapshot.

You can make your own `JournalStore` very easily. Store the journal in Postgres, Durable Object etc... as long as you can connect to it, it will work!

Given how malleable and lightweight this project is, you can use it as a base to build your own Durable Workflow API as we did in Terse. That is the beauty of this.

# What do we Support?

Here is a list of the table-stake durability feature that are currently in:

- Starting, resuming, retrying a workflow
- Journaling steps
- Step() support for defining durable steps
- Passing in Workflow context and reading it from the workflow
- Pinning Date() and seeded Random number generate for idempotent replays. (uses runId for seeding)
- Creating custom hooks for suspending and resuming with external data

# Documentation

No need for a separate docs website, it's incredibly simple to get started.

```
hello world example
```
