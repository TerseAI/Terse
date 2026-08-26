import { afterEach, expect, vi } from "vitest"

import { FileJournalStore, Runtime, sleep } from "../../src/index.js"
import { test } from "../fixtures/filesystem.js"

afterEach(() => {
    vi.useRealTimers()
})

test("sleep suspends a workflow for a human-readable duration", async ({ journalDirectory }) => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-08-26T12:00:00.000Z"))

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
    expect(outcome).toMatchObject({
        status: "suspended",
        suspension: {
            waitId: expect.stringMatching(/^wait_/),
            request: {
                type: "timer",
                wakeAt: "2026-08-26T20:00:00.000Z"
            }
        }
    })

    if (outcome.status !== "suspended") throw new Error("Expected the workflow to be suspended")

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
            wakeAt: "2026-08-26T20:00:00.000Z"
        }
    })
})
