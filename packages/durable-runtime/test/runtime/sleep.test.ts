import { expect } from "vitest"

import { FileJournalStore, Runtime, sleep } from "../../src/index.js"
import { test } from "../fixtures/filesystem.js"

test("sleep suspends a workflow for a human-readable duration", async ({ journalDirectory }) => {
    const journalStore = new FileJournalStore(journalDirectory)
    const execution: string[] = []

    const outcome = await new Runtime({ journalStore }).start({
        runId: "run-123",
        workflowName: "test-workflow",
        input: null,
        workflow: async () => {
            execution.push("before")
            await sleep("8h")
            execution.push("after")
        }
    })

    expect(execution).toEqual(["before"])
    if (outcome.status !== "suspended") throw new Error("Expected the workflow to be suspended")

    const [startedEvent] = await journalStore.listByType({
        runId: "run-123",
        eventType: "run.started"
    })

    if (startedEvent?.type !== "run.started") throw new Error("Expected a run.started event")

    const wakeAt = new Date(Date.parse(startedEvent.startedAt) + 8 * 60 * 60 * 1_000).toISOString()

    expect(outcome).toMatchObject({
        status: "suspended",
        suspension: {
            waitId: expect.stringMatching(/^wait_/),
            request: {
                type: "timer",
                wakeAt
            }
        }
    })

    expect(
        await journalStore.listByType({
            runId: "run-123",
            eventType: "run.completed"
        })
    ).toHaveLength(0)

    const requestedEvents = await journalStore.listByType({
        runId: "run-123",
        eventType: "wait.requested"
    })

    expect(requestedEvents).toHaveLength(1)
    expect(requestedEvents[0]).toMatchObject({
        type: "wait.requested",
        waitId: outcome.suspension.waitId,
        request: {
            type: "timer",
            wakeAt
        }
    })
})
