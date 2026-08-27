import { expect } from "vitest"
import { z } from "zod"

import { FileJournalStore, JournalEventSchema, Runtime, createRunEventId, createStepEventId, defineWorkflow, step } from "../../src/index.js"
import type { JournalStore } from "../../src/index.js"
import { test } from "../fixtures/filesystem.js"
import { defineInputlessWorkflow } from "../fixtures/workflow.js"

test("gets run metadata without exposing journal events", async ({ journalDirectory }) => {
    const runtime = new Runtime({ journalStore: new FileJournalStore(journalDirectory) })

    await runtime.start({
        runId: "run-123",
        workflowName: "test-workflow",
        input: null,
        workflow: defineInputlessWorkflow(async () => {})
    })

    expect(await runtime.getRun({ runId: "run-123" })).toEqual({
        runId: "run-123",
        workflowName: "test-workflow",
        startedAt: expect.any(String)
    })
})

test("getting a run that does not exist fails", async ({ journalDirectory }) => {
    const runtime = new Runtime({ journalStore: new FileJournalStore(journalDirectory) })

    await expect(runtime.getRun({ runId: "missing-run" })).rejects.toThrow('Run "missing-run" does not exist')
})

test("runs a step and records its input", async ({ journalDirectory }) => {
    const journalStore = new FileJournalStore(journalDirectory)
    const runtime = new Runtime({ journalStore })
    let result: string | undefined

    await runtime.start({
        runId: "run-123",
        workflowName: "test-workflow",
        input: null,
        workflow: defineInputlessWorkflow(async () => {
            result = await step({
                name: "create-greeting",
                input: {
                    person: "Ada"
                },
                run: async input => `Hello, ${input.person}`
            })
        })
    })

    expect(result).toBe("Hello, Ada")

    const startedEvents = await journalStore.listByType({
        runId: "run-123",
        eventType: "step.started"
    })

    expect(startedEvents).toHaveLength(1)
    const [startedEvent] = startedEvents

    const completedEvents = await journalStore.listByType({
        runId: "run-123",
        eventType: "step.completed"
    })

    expect(completedEvents).toHaveLength(1)
    const [completedEvent] = completedEvents

    if (startedEvent?.type !== "step.started") throw new Error("Expected a step.started event")
    if (completedEvent?.type !== "step.completed") throw new Error("Expected a step.completed event")

    expect(startedEvent.eventId).toBe(createStepEventId({ type: "step.started", stepId: startedEvent.stepId }))
    expect(completedEvent.stepId).toBe(startedEvent.stepId)
    expect(completedEvent.eventId).toBe(createStepEventId({ type: "step.completed", stepId: startedEvent.stepId }))

    expect(startedEvent).toMatchObject({
        type: "step.started",
        name: "create-greeting",
        input: {
            person: "Ada"
        }
    })

    expect(completedEvent).toMatchObject({
        type: "step.completed",
        name: "create-greeting",
        output: "Hello, Ada"
    })
})

test("resuming an interrupted step does not record another step started event", async ({ journalDirectory }) => {
    const interruptedError = new Error("runtime interrupted")
    const fileJournalStore = new FileJournalStore(journalDirectory)
    let interruptCompletionWrite = true
    const interruptedJournalStore: JournalStore = {
        list: params => fileJournalStore.list(params),
        listByType: params => fileJournalStore.listByType(params),
        get: params => fileJournalStore.get(params),
        append: async params => {
            const event = JournalEventSchema.parse(params.event)
            if (event.type === "step.completed" && interruptCompletionWrite) {
                interruptCompletionWrite = false
                throw interruptedError
            }

            return fileJournalStore.append(params)
        }
    }
    let stepExecutions = 0
    const workflow = defineInputlessWorkflow(async () => {
        await step({
            name: "create-greeting",
            input: {
                person: "Ada"
            },
            run: async input => {
                stepExecutions++
                return `Hello, ${input.person}`
            }
        })
    })

    await expect(
        new Runtime({ journalStore: interruptedJournalStore }).start({
            runId: "run-123",
            workflowName: "test-workflow",
            input: null,
            workflow
        })
    ).rejects.toBe(interruptedError)

    expect(await fileJournalStore.listByType({ runId: "run-123", eventType: "step.started" })).toHaveLength(1)
    expect(await fileJournalStore.listByType({ runId: "run-123", eventType: "step.completed" })).toHaveLength(0)

    await new Runtime({ journalStore: fileJournalStore }).resume({
        runId: "run-123",
        workflow
    })

    expect(stepExecutions).toBe(2)
    expect(await fileJournalStore.listByType({ runId: "run-123", eventType: "step.started" })).toHaveLength(1)
    expect(await fileJournalStore.listByType({ runId: "run-123", eventType: "step.completed" })).toHaveLength(1)
})

test("resuming a completed workflow does not run it again", async ({ journalDirectory }) => {
    let workflowExecutions = 0
    let stepExecutions = 0
    const results: string[] = []

    const workflow = defineInputlessWorkflow(async () => {
        workflowExecutions++

        const result = await step({
            name: "create-greeting",
            input: {
                person: "Ada"
            },
            run: async input => {
                stepExecutions++
                return `Hello, ${input.person}`
            }
        })

        results.push(result)
    })

    const journalStore = new FileJournalStore(journalDirectory)

    await new Runtime({ journalStore }).start({
        runId: "run-123",
        workflowName: "test-workflow",
        input: null,
        workflow
    })

    await new Runtime({
        journalStore: new FileJournalStore(journalDirectory)
    }).resume({
        runId: "run-123",
        workflow
    })

    expect(workflowExecutions).toBe(1)
    expect(stepExecutions).toBe(1)
    expect(results).toEqual(["Hello, Ada"])

    expect(
        await journalStore.listByType({
            runId: "run-123",
            eventType: "run.completed"
        })
    ).toHaveLength(1)

    expect(
        await journalStore.listByType({
            runId: "run-123",
            eventType: "step.started"
        })
    ).toHaveLength(1)

    expect(
        await journalStore.listByType({
            runId: "run-123",
            eventType: "step.completed"
        })
    ).toHaveLength(1)
})

test("runs a step that throws and records the error", async ({ journalDirectory }) => {
    const journalStore = new FileJournalStore(journalDirectory)
    const runtime = new Runtime({ journalStore })
    const stepError = new Error("test error")

    await expect(
        runtime.start({
            runId: "run-123",
            workflowName: "test-workflow",
            input: null,
            workflow: defineInputlessWorkflow(async () => {
                await step({
                    name: "create-greeting",
                    input: {
                        person: "Ada"
                    },
                    run: async () => {
                        throw stepError
                    }
                })
            })
        })
    ).rejects.toBe(stepError)

    const startedEvents = await journalStore.listByType({
        runId: "run-123",
        eventType: "step.started"
    })

    expect(startedEvents).toHaveLength(1)
    const [startedEvent] = startedEvents

    const completedEvents = await journalStore.listByType({
        runId: "run-123",
        eventType: "step.completed"
    })

    expect(completedEvents).toHaveLength(0)

    const failedEvents = await journalStore.listByType({
        runId: "run-123",
        eventType: "step.failed"
    })

    expect(failedEvents).toHaveLength(1)
    const [failedEvent] = failedEvents

    if (startedEvent?.type !== "step.started") throw new Error("Expected a step.started event")
    if (failedEvent?.type !== "step.failed") throw new Error("Expected a step.failed event")

    expect(startedEvent.eventId).toBe(createStepEventId({ type: "step.started", stepId: startedEvent.stepId }))
    expect(failedEvent.stepId).toBe(startedEvent.stepId)
    expect(failedEvent.eventId).toBe(createStepEventId({ type: "step.failed", stepId: startedEvent.stepId }))

    expect(startedEvent).toMatchObject({
        type: "step.started",
        name: "create-greeting",
        input: {
            person: "Ada"
        }
    })

    expect(failedEvent).toMatchObject({
        type: "step.failed",
        name: "create-greeting",
        error: {
            message: "test error"
        }
    })
})

test("starting a workflow records its run started event", async ({ journalDirectory }) => {
    const journalStore = new FileJournalStore(journalDirectory)
    const runtime = new Runtime({
        journalStore
    })
    const input = {
        type: "example.received",
        payload: {
            id: "example-123",
            labels: ["important"],
            enabled: true
        }
    }
    let receivedInput: typeof input | undefined

    const workflow = defineWorkflow({
        input: z
            .object({
                type: z.string(),
                payload: z.object({ id: z.string(), labels: z.array(z.string()), enabled: z.boolean() }).strict()
            })
            .strict(),
        run: async event => {
            receivedInput = event
        }
    })

    await runtime.start({
        workflow,
        runId: "run-123",
        workflowName: "test-workflow",
        input
    })

    expect(receivedInput).toEqual(input)
    const eventId = createRunEventId({ type: "run.started" })
    expect(await journalStore.get({ runId: "run-123", eventId })).toMatchObject({
        eventId,
        type: "run.started",
        workflowName: "test-workflow",
        input
    })
})

test("cannot start a run again after the runtime restarts", async ({ journalDirectory }) => {
    const runtime = new Runtime({
        journalStore: new FileJournalStore(journalDirectory)
    })

    await runtime.start({
        workflow: defineInputlessWorkflow(async () => undefined),
        runId: "run-123",
        workflowName: "first-workflow",
        input: null
    })

    let secondWorkflowWasExecuted = false
    const restartedJournalStore = new FileJournalStore(journalDirectory)
    const restartedRuntime = new Runtime({
        journalStore: restartedJournalStore
    })

    await expect(
        restartedRuntime.start({
            workflow: defineInputlessWorkflow(async () => {
                secondWorkflowWasExecuted = true
            }),
            runId: "run-123",
            workflowName: "second-workflow",
            input: null
        })
    ).rejects.toThrow()

    expect(secondWorkflowWasExecuted).toBe(false)
    expect(await restartedJournalStore.listByType({ runId: "run-123", eventType: "run.started" })).toHaveLength(1)
})

test("does not execute the workflow when recording its start fails", async () => {
    const journalError = new Error("journal unavailable")
    const journalStore: JournalStore = {
        list: async () => [],
        listByType: async () => [],
        get: async () => undefined,
        append: async () => {
            throw journalError
        }
    }
    const runtime = new Runtime({ journalStore })
    let workflowWasExecuted = false

    await expect(
        runtime.start({
            workflow: defineInputlessWorkflow(async () => {
                workflowWasExecuted = true
            }),
            runId: "run-123",
            workflowName: "test-workflow",
            input: null
        })
    ).rejects.toBe(journalError)

    expect(workflowWasExecuted).toBe(false)
})
