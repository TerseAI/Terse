# Documentation

## Core Concepts

This is a durable workflow SDK. What does this mean?

Durable Workflows are **functions** that are broken up into **steps**. Each step is an idempotent chunk of work that has a a serializable input and output.

After each step runs, we write both input and output to a **journal**. In the event a step fails (say, because github is down... again), you resume the run and it will hit the journal cache for the steps that completed successfully, thus resuming real work at the point it failed.

Each workflow is executed in a **runtime**. This is what calls the internal function and injects context variables into the system.

## How to Make A Runtime

The runtime protocol here is very simple.

```ts
export class Runtime {
    // Start a workflow, you need to mint a run-id here. Ideally comes from your control plane and you store it!
    async start<InputSchema extends z.ZodType>({ runId, input, workflow }: StartParams<InputSchema>): Promise<RuntimeOutcome>

    // Resume a workflow suspended on a hook.
    async resumeHook<Hook extends AnyHookDefinition, InputSchema extends z.ZodType>(hook: Hook, params: ResumeHookParams<InputSchema, Hook>): Promise<RuntimeOutcome>

    // Wake from a sleep(). Under the hood, this calls resumeHook(). We just enforce the expected duration has passed.
    async resumeTimer<InputSchema extends z.ZodType>({ runId, workflow, waitId }: ResumeTimerParams<InputSchema>): Promise<RuntimeOutcome>

    // Convenience method to fetch run metadata of a run id
    async getRun({ runId }: GetRunParams): Promise<RunMetadata>

    // convenience method to fetch suspension status of a run id
    async getSuspension({ runId }: GetSuspensionParams): Promise<Suspension | undefined>
}
```

All you need to initialize one, is a **JournalStore**. In this v0.1, we have the FileJournalStore available for use.

```ts
const journalDirectory = await mkdtemp(join(tmpdir(), "terse-durable-test-"))
const journalStore = new FileJournalStore(journalDirectory)
const runtime = new Runtime({ journalStore })

// You can now run/resume workflows!

runtime.start(...)
```

Remember, with FileJournalStore, you need journal data in that path if you plan on resuming a workflow! We take sandbox snapshots here to solve for this. There will be no durability if you don't persist the journal state correctly!

## How to Define a Workflow

Workflows just need a name, input schema and a closure.

```ts
const workflow = defineWorkflow({
    name: "test-workflow",
    input: z.object({
        recipient: z.string(),
        name: z.string()
    }),
    run: async input => {
        console.log("Hello world")
    }
})
```

Now, we can combine that with our runtime above and run our first workflow!

```ts
const outcome = await runtime.start({
    runId: "run-123",
    input: {
        recipient: "ada@example.com",
        name: "Ada"
    },
    workflow
})

if (outcome.status === "completed") {
    // Yay it run!
    console.log("Workflow completed")
} else {
    console.log("Workflow suspended", outcome.suspension)
}
```

Ok so far not the most interesting, now it's time to build our first **Step**.

## Building Steps

Similar to a workflow, a step needs a name, schemas and closures.

```ts
const message = await step({
    name: "prepare-message",
    input: {
        name: input.name
    },
    run: async ({ name }) => {
        return `Welcome, ${name}!`
    }
})
```

The closure here is where you go and do I/O, reach out to slack github etc... run a model whatever you need to do!

You simply nest it in your workflow:

```ts
const workflow = defineWorkflow({
    name: "test-workflow",
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

                // pretend this needs to reach out to github
                return `Welcome, ${name}!`
            }
        })
    }
})
```

## Pausing a Workflow

Pausing a workflow is done with ```sleep()```.

```ts
const workflow = defineWorkflow({
    name: "test-workflow",
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

                // pretend this needs to reach out to github
                return `Welcome, ${name}!`
            }
        })
        
        await sleep("1d")

        const message2 = await step({
            name: "prepare-message",
            input: {
                name: input.name
            },
            run: async ({ name }) => {

                // pretend this needs to reach out to github
                return `Welcome, ${name}. first message was ${message}!`
            }
        })
    }
})
```

You can do as many sleep() in a workflow as you want. (even in a for loop!).

The input is a human readable string duration:

```ts
await sleep("30s")
await sleep("5m")
await sleep("2h")
await sleep("1d")
```

## Defining a Hook

Probably the most important part of this project is how hooks are made.

Defining a hook comes down to specifying the **Request Schema** and the **Resolution Schema**. The Request Schema, is what gets sent out to the control plane. Ex: for requesting approval in slack, you would want to list options here + a message.

The Resolution Schema would be what slack provides back and what you would use in a later step in your workflow.

```ts
const SlackDisambiguationRequestSchema = z.object({
    message: z.string(),
    options: z.array(z.string()).min(2)
})

const SlackDisambiguationResponseSchema = z.object({
    selectedOption: z.number().int().nonnegative()
})

const SlackDisambiguationHook = defineHook({
    name: "slack-disambiguation",
    request: SlackDisambiguationRequestSchema,
    resolution: SlackDisambiguationResponseSchema
})
```

Now that your hook is defined, you can use it to suspend a workflow and read the response!

```ts

const DeploymentWorkflow = defineWorkflow({
    name: "deploy-application",
    input: z.object({}),
    run: async () => {
        const response = await waitFor(SlackDisambiguationHook, {
            message: "Which environment should we deploy to?",
            options: ["Development", "Staging", "Production"]
        })

        console.log(response)
    }
})
```

> Note: You need to handle how this communicates with slack here! More on this in the next section

## How to Interact With Control Plane

This project is BYOCP (Bring your own control plane, yes I just invented that).

It can be tempting to want to a loop structure here like:
