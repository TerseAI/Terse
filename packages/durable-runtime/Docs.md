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

## Pausing a Workflow

## Defining a Hook

## How to Interact With Control Plane