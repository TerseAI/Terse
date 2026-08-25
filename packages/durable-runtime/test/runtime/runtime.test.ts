import { expect } from "vitest"

import { FileJournalStore, Runtime, step } from "../../src/index.js"
import type { JournalStore } from "../../src/index.js"
import { test } from "../fixtures/filesystem.js"

test("runs a step and records its input", async ({ journalDirectory }) => {
    const journalStore = new FileJournalStore(journalDirectory)
    const runtime = new Runtime({ journalStore })
    let result: string | undefined

    await runtime.start({
        runId: "run-123",
        workflowName: "test-workflow",
        input: null,
        workflow: async () => {
            result = await step({
                name: "create-greeting",
                input: {
                    person: "Ada"
                },
                run: async input => `Hello, ${input.person}`
            })
        }
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

    await runtime.start({
        workflow: async event => {
            receivedInput = event
        },
        runId: "run-123",
        workflowName: "test-workflow",
        input
    })

    expect(receivedInput).toEqual(input)
    expect(await journalStore.get({ runId: "run-123", eventId: "run.started" })).toMatchObject({
        eventId: "run.started",
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
        workflow: async () => undefined,
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
            workflow: async () => {
                secondWorkflowWasExecuted = true
            },
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
            workflow: async () => {
                workflowWasExecuted = true
            },
            runId: "run-123",
            workflowName: "test-workflow",
            input: null
        })
    ).rejects.toBe(journalError)

    expect(workflowWasExecuted).toBe(false)
})
