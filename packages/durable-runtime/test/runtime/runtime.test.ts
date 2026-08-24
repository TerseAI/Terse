import { expect } from "vitest"

import { FileJournalStore, Runtime } from "../../src/index.js"
import { test } from "../fixtures/filesystem.js"

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

test("cannot start two workflows with the same run ID", async ({ journalDirectory }) => {
    const journalStore = new FileJournalStore(journalDirectory)
    const runtime = new Runtime({
        journalStore
    })

    await runtime.start({
        workflow: async () => undefined,
        runId: "run-123",
        workflowName: "first-workflow",
        input: null
    })

    let secondWorkflowWasExecuted = false

    await expect(
        runtime.start({
            workflow: async () => {
                secondWorkflowWasExecuted = true
            },
            runId: "run-123",
            workflowName: "second-workflow",
            input: null
        })
    ).rejects.toThrow()

    expect(secondWorkflowWasExecuted).toBe(false)
    expect(await journalStore.listByType({ runId: "run-123", eventType: "run.started" })).toHaveLength(1)
})
