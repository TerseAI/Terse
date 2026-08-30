import { setTimeout as delay } from "node:timers/promises"
import { expect } from "vitest"

import { FileJournalStore, JournalEventSchema, Runtime, sleep } from "../../src/index.js"
import type { JournalStore } from "../../src/index.js"
import { test } from "../fixtures/filesystem.js"
import { defineInputlessWorkflow } from "../fixtures/workflow.js"

test("delivering the same resolution again is idempotent", async ({ journalDirectory }) => {
    const execution: string[] = []
    const workflow = defineInputlessWorkflow(async () => {
        execution.push("before-first-sleep")
        await sleep("20ms")
        execution.push("before-second-sleep")
        await sleep("5s")
        execution.push("after-second-sleep")
    })
    const journalStore = new FileJournalStore(journalDirectory)
    const firstOutcome = await new Runtime({ journalStore }).start(workflow, {
        runId: "run-123",
        input: null
    })

    if (firstOutcome.status !== "suspended") throw new Error("Expected the workflow to be suspended")

    await delay(35)

    const secondOutcome = await new Runtime({ journalStore }).resumeTimer(workflow, {
        runId: "run-123",
        waitId: firstOutcome.suspension.waitId
    })

    if (secondOutcome.status !== "suspended") throw new Error("Expected the workflow to be suspended")
    expect(secondOutcome.suspension.waitId).not.toBe(firstOutcome.suspension.waitId)

    const duplicateOutcome = await new Runtime({ journalStore }).resumeTimer(workflow, {
        runId: "run-123",
        waitId: firstOutcome.suspension.waitId
    })

    expect(duplicateOutcome).toEqual(secondOutcome)
    expect(execution).toEqual(["before-first-sleep", "before-first-sleep", "before-second-sleep", "before-first-sleep", "before-second-sleep"])
    expect(await journalStore.listByType({ runId: "run-123", eventType: "wait.requested" })).toHaveLength(2)
    expect(await journalStore.listByType({ runId: "run-123", eventType: "wait.resolved" })).toHaveLength(1)
    expect(await journalStore.listByType({ runId: "run-123", eventType: "run.completed" })).toHaveLength(0)
})

test("rejects a conflicting resolution for an already resolved wait", async ({ journalDirectory }) => {
    const execution: string[] = []
    const workflow = defineInputlessWorkflow(async () => {
        execution.push("before-first-sleep")
        await sleep("20ms")
        execution.push("before-second-sleep")
        await sleep("5s")
    })
    const journalStore = new FileJournalStore(journalDirectory)
    const firstOutcome = await new Runtime({ journalStore }).start(workflow, {
        runId: "run-123",
        input: null
    })

    if (firstOutcome.status !== "suspended") throw new Error("Expected the workflow to be suspended")

    await delay(35)

    await new Runtime({ journalStore }).resumeTimer(workflow, {
        runId: "run-123",
        waitId: firstOutcome.suspension.waitId
    })

    await expect(
        new Runtime({ journalStore }).resume(workflow, {
            runId: "run-123",
            event: {
                type: "wait.resolved",
                waitId: firstOutcome.suspension.waitId,
                payload: false
            }
        })
    ).rejects.toThrow("already resolved with a different payload")

    expect(execution).toEqual(["before-first-sleep", "before-first-sleep", "before-second-sleep"])

    const resolvedEvents = await journalStore.listByType({
        runId: "run-123",
        eventType: "wait.resolved"
    })

    expect(resolvedEvents).toHaveLength(1)
    expect(resolvedEvents[0]).toMatchObject({
        type: "wait.resolved",
        waitId: firstOutcome.suspension.waitId,
        payload: {}
    })
})

test("rejects a resolution for an unknown wait before replaying", async ({ journalDirectory }) => {
    const execution: string[] = []
    const workflow = defineInputlessWorkflow(async () => {
        execution.push("before")
        await sleep("5s")
    })
    const journalStore = new FileJournalStore(journalDirectory)

    await new Runtime({ journalStore }).start(workflow, {
        runId: "run-123",
        input: null
    })

    await expect(
        new Runtime({ journalStore }).resume(workflow, {
            runId: "run-123",
            event: {
                type: "wait.resolved",
                waitId: "wait-unknown",
                payload: null
            }
        })
    ).rejects.toThrow('Wait "wait-unknown" does not exist in run "run-123"')

    expect(execution).toEqual(["before"])
    expect(await journalStore.listByType({ runId: "run-123", eventType: "wait.resolved" })).toHaveLength(0)
})

test("does not replay when recording a resolution fails", async ({ journalDirectory }) => {
    const execution: string[] = []
    const workflow = defineInputlessWorkflow(async () => {
        execution.push("before")
        await sleep("20ms")
        execution.push("after")
    })
    const journalStore = new FileJournalStore(journalDirectory)
    const firstOutcome = await new Runtime({ journalStore }).start(workflow, {
        runId: "run-123",
        input: null
    })

    if (firstOutcome.status !== "suspended") throw new Error("Expected the workflow to be suspended")

    await delay(35)

    const journalError = new Error("journal unavailable")
    const failingJournalStore: JournalStore = {
        list: params => journalStore.list(params),
        listByType: params => journalStore.listByType(params),
        get: params => journalStore.get(params),
        append: async params => {
            const event = JournalEventSchema.parse(params.event)
            if (event.type === "wait.resolved") throw journalError
            return journalStore.append(params)
        }
    }

    await expect(
        new Runtime({ journalStore: failingJournalStore }).resume(workflow, {
            runId: "run-123",
            event: {
                type: "wait.resolved",
                waitId: firstOutcome.suspension.waitId,
                payload: null
            }
        })
    ).rejects.toBe(journalError)

    expect(execution).toEqual(["before"])
    expect(await journalStore.listByType({ runId: "run-123", eventType: "wait.resolved" })).toHaveLength(0)
})

test("a resolution delivered after run completion is a no-op", async ({ journalDirectory }) => {
    let workflowExecutions = 0
    const workflow = defineInputlessWorkflow(async () => {
        workflowExecutions++
    })
    const journalStore = new FileJournalStore(journalDirectory)

    await new Runtime({ journalStore }).start(workflow, {
        runId: "run-123",
        input: null
    })

    const outcome = await new Runtime({ journalStore }).resume(workflow, {
        runId: "run-123",
        event: {
            type: "wait.resolved",
            waitId: "wait-stale",
            payload: null
        }
    })

    expect(outcome).toEqual({ status: "completed" })
    expect(workflowExecutions).toBe(1)
    expect(await journalStore.listByType({ runId: "run-123", eventType: "wait.resolved" })).toHaveLength(0)
})

test("resuming an unresolved run returns the same suspension", async ({ journalDirectory }) => {
    const execution: string[] = []
    const workflow = defineInputlessWorkflow(async () => {
        execution.push("before")
        await sleep("8h")
        execution.push("after")
    })

    const firstOutcome = await new Runtime({
        journalStore: new FileJournalStore(journalDirectory)
    }).start(workflow, {
        runId: "run-123",
        input: null
    })

    expect(firstOutcome.status).toBe("suspended")

    const restartedJournalStore = new FileJournalStore(journalDirectory)
    const resumedOutcome = await new Runtime({
        journalStore: restartedJournalStore
    }).resume(workflow, { runId: "run-123" })

    expect(resumedOutcome).toEqual(firstOutcome)
    expect(execution).toEqual(["before", "before"])
    expect(
        await restartedJournalStore.listByType({
            runId: "run-123",
            eventType: "wait.requested"
        })
    ).toHaveLength(1)
    expect(
        await restartedJournalStore.listByType({
            runId: "run-123",
            eventType: "run.completed"
        })
    ).toHaveLength(0)
})
