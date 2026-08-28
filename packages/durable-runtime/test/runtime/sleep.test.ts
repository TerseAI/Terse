import { setTimeout as delay } from "node:timers/promises"
import { expect } from "vitest"

import { FileJournalStore, Runtime, sleep } from "../../src/index.js"
import { test } from "../fixtures/filesystem.js"
import { defineInputlessWorkflow } from "../fixtures/workflow.js"

test("sleep suspends a workflow for a human-readable duration", async ({ journalDirectory }) => {
    const journalStore = new FileJournalStore(journalDirectory)
    const execution: string[] = []

    const outcome = await new Runtime({ journalStore }).start({
        runId: "run-123",
        input: null,
        workflow: defineInputlessWorkflow(async () => {
            execution.push("before")
            await sleep("8h")
            execution.push("after")
        })
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
                type: "hook",
                name: "timer",
                payload: {
                    wakeAt
                }
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
            type: "hook",
            name: "timer",
            payload: {
                wakeAt
            }
        }
    })
})

test("sleep remains suspended when resumed before its wake time", async ({ journalDirectory }) => {
    const execution: string[] = []
    const workflow = defineInputlessWorkflow(async () => {
        execution.push("before")
        await sleep("5s")
        execution.push("after")
    })
    const journalStore = new FileJournalStore(journalDirectory)

    const firstOutcome = await new Runtime({ journalStore }).start({
        runId: "run-123",
        input: null,
        workflow
    })
    if (firstOutcome.status !== "suspended") throw new Error("Expected the workflow to be suspended")

    const resumedOutcome = await new Runtime({
        journalStore: new FileJournalStore(journalDirectory)
    }).resumeTimer({
        runId: "run-123",
        workflow,
        waitId: firstOutcome.suspension.waitId
    })

    expect(resumedOutcome).toEqual(firstOutcome)
    expect(execution).toEqual(["before", "before"])
    expect(
        await journalStore.listByType({
            runId: "run-123",
            eventType: "wait.resolved"
        })
    ).toHaveLength(0)
})

test("sleep completes when resumed after its wake time", async ({ journalDirectory }) => {
    const execution: string[] = []
    const workflow = defineInputlessWorkflow(async () => {
        execution.push("before")
        await sleep("50ms")
        execution.push("after")
    })
    const journalStore = new FileJournalStore(journalDirectory)

    const firstOutcome = await new Runtime({ journalStore }).start({
        runId: "run-123",
        input: null,
        workflow
    })

    if (firstOutcome.status !== "suspended") throw new Error("Expected the workflow to be suspended")

    await delay(75)

    const unresolvedOutcome = await new Runtime({
        journalStore: new FileJournalStore(journalDirectory)
    }).resume({
        runId: "run-123",
        workflow
    })

    expect(unresolvedOutcome).toEqual(firstOutcome)

    const resumedOutcome = await new Runtime({
        journalStore: new FileJournalStore(journalDirectory)
    }).resumeTimer({
        runId: "run-123",
        workflow,
        waitId: firstOutcome.suspension.waitId
    })

    expect(resumedOutcome).toEqual({ status: "completed" })
    expect(execution).toEqual(["before", "before", "before", "after"])
    expect(
        await journalStore.listByType({
            runId: "run-123",
            eventType: "wait.requested"
        })
    ).toHaveLength(1)
    expect(
        await journalStore.listByType({
            runId: "run-123",
            eventType: "wait.resolved"
        })
    ).toHaveLength(1)
    expect(
        await journalStore.listByType({
            runId: "run-123",
            eventType: "run.completed"
        })
    ).toHaveLength(1)
})
