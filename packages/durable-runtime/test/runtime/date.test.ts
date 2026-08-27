import { expect } from "vitest"

import { FileJournalStore, Runtime } from "../../src/index.js"

import { test } from "../fixtures/filesystem.js"

test("Date.now returns the workflow's logical time", async ({ journalDirectory }) => {
    const journalStore = new FileJournalStore(journalDirectory)
    let timestamp: number | undefined

    await new Runtime({ journalStore }).start({
        runId: "run-123",
        workflowName: "test-workflow",
        input: null,
        workflow: async () => {
            timestamp = Date.now()
        }
    })

    const [startedEvent] = await journalStore.listByType({
        runId: "run-123",
        eventType: "run.started"
    })

    if (startedEvent?.type !== "run.started") throw new Error("Expected a run.started event")
    expect(timestamp).toBe(Date.parse(startedEvent.startedAt))
})

test("new Date returns the workflow's logical time", async ({ journalDirectory }) => {
    const journalStore = new FileJournalStore(journalDirectory)
    let date: Date | undefined

    await new Runtime({ journalStore }).start({
        runId: "run-123",
        workflowName: "test-workflow",
        input: null,
        workflow: async () => {
            date = new Date()
        }
    })

    const [startedEvent] = await journalStore.listByType({
        runId: "run-123",
        eventType: "run.started"
    })

    if (startedEvent?.type !== "run.started") throw new Error("Expected a run.started event")
    expect(date?.toISOString()).toBe(startedEvent.startedAt)
})

test("Date called as a function returns the workflow's logical time", async ({ journalDirectory }) => {
    const journalStore = new FileJournalStore(journalDirectory)
    let date: string | undefined

    await new Runtime({ journalStore }).start({
        runId: "run-123",
        workflowName: "test-workflow",
        input: null,
        workflow: async () => {
            date = Date()
        }
    })

    const [startedEvent] = await journalStore.listByType({
        runId: "run-123",
        eventType: "run.started"
    })

    if (startedEvent?.type !== "run.started") throw new Error("Expected a run.started event")
    expect(date).toBe(new Date(startedEvent.startedAt).toString())
})
