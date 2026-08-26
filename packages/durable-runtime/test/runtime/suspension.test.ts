import { setTimeout as delay } from "node:timers/promises"

import { expect } from "vitest"

import { FileJournalStore, Runtime, sleep } from "../../src/index.js"
import type { JournalStore } from "../../src/index.js"
import { test } from "../fixtures/filesystem.js"

test("delivering the same resolution again is idempotent", async ({ journalDirectory }) => {
    const execution: string[] = []
    const workflow = async () => {
        execution.push("before-first-sleep")
        await sleep("20ms")
        execution.push("before-second-sleep")
        await sleep("5s")
        execution.push("after-second-sleep")
    }
    const journalStore = new FileJournalStore(journalDirectory)
    const firstOutcome = await new Runtime({ journalStore }).start({
        runId: "run-123",
        workflowName: "test-workflow",
        input: null,
        workflow
    })

    if (firstOutcome.status !== "suspended") throw new Error("Expected the workflow to be suspended")

    await delay(35)

    const secondOutcome = await new Runtime({ journalStore }).resume({
        runId: "run-123",
        workflow,
        event: {
            type: "wait.resolved",
            waitId: firstOutcome.suspension.waitId,
            payload: null
        }
    })

    if (secondOutcome.status !== "suspended") throw new Error("Expected the workflow to be suspended")
    expect(secondOutcome.suspension.waitId).not.toBe(firstOutcome.suspension.waitId)

    const duplicateOutcome = await new Runtime({ journalStore }).resume({
        runId: "run-123",
        workflow,
        event: {
            type: "wait.resolved",
            waitId: firstOutcome.suspension.waitId,
            payload: null
        }
    })

    expect(duplicateOutcome).toEqual(secondOutcome)
    expect(execution).toEqual([
        "before-first-sleep",
        "before-first-sleep",
        "before-second-sleep",
        "before-first-sleep",
        "before-second-sleep"
    ])
    expect(await journalStore.listByType({ runId: "run-123", eventType: "wait.requested" })).toHaveLength(2)
    expect(await journalStore.listByType({ runId: "run-123", eventType: "wait.resolved" })).toHaveLength(1)
    expect(await journalStore.listByType({ runId: "run-123", eventType: "run.completed" })).toHaveLength(0)
})

test("rejects a conflicting resolution for an already resolved wait", async ({ journalDirectory }) => {
    const execution: string[] = []
    const workflow = async () => {
        execution.push("before-first-sleep")
        await sleep("20ms")
        execution.push("before-second-sleep")
        await sleep("5s")
    }
    const journalStore = new FileJournalStore(journalDirectory)
    const firstOutcome = await new Runtime({ journalStore }).start({
        runId: "run-123",
        workflowName: "test-workflow",
        input: null,
        workflow
    })

    if (firstOutcome.status !== "suspended") throw new Error("Expected the workflow to be suspended")

    await delay(35)

    await new Runtime({ journalStore }).resume({
        runId: "run-123",
        workflow,
        event: {
            type: "wait.resolved",
            waitId: firstOutcome.suspension.waitId,
            payload: null
        }
    })

    await expect(
        new Runtime({ journalStore }).resume({
            runId: "run-123",
            workflow,
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
        payload: null
    })
})

test("rejects a resolution for an unknown wait before replaying", async ({ journalDirectory }) => {
    const execution: string[] = []
    const workflow = async () => {
        execution.push("before")
        await sleep("5s")
    }
    const journalStore = new FileJournalStore(journalDirectory)

    await new Runtime({ journalStore }).start({
        runId: "run-123",
        workflowName: "test-workflow",
        input: null,
        workflow
    })

    await expect(
        new Runtime({ journalStore }).resume({
            runId: "run-123",
            workflow,
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
    const workflow = async () => {
        execution.push("before")
        await sleep("20ms")
        execution.push("after")
    }
    const journalStore = new FileJournalStore(journalDirectory)
    const firstOutcome = await new Runtime({ journalStore }).start({
        runId: "run-123",
        workflowName: "test-workflow",
        input: null,
        workflow
    })

    if (firstOutcome.status !== "suspended") throw new Error("Expected the workflow to be suspended")

    await delay(35)

    const journalError = new Error("journal unavailable")
    const failingJournalStore: JournalStore = {
        list: params => journalStore.list(params),
        listByType: params => journalStore.listByType(params),
        get: params => journalStore.get(params),
        append: async params => {
            if (params.event.type === "wait.resolved") throw journalError
            await journalStore.append(params)
        }
    }

    await expect(
        new Runtime({ journalStore: failingJournalStore }).resume({
            runId: "run-123",
            workflow,
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
    const workflow = async () => {
        workflowExecutions++
    }
    const journalStore = new FileJournalStore(journalDirectory)

    await new Runtime({ journalStore }).start({
        runId: "run-123",
        workflowName: "test-workflow",
        input: null,
        workflow
    })

    const outcome = await new Runtime({ journalStore }).resume({
        runId: "run-123",
        workflow,
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
    const workflow = async () => {
        execution.push("before")
        await sleep("8h")
        execution.push("after")
    }

    const firstOutcome = await new Runtime({
        journalStore: new FileJournalStore(journalDirectory)
    }).start({
        runId: "run-123",
        workflowName: "test-workflow",
        input: null,
        workflow
    })

    expect(firstOutcome.status).toBe("suspended")

    const restartedJournalStore = new FileJournalStore(journalDirectory)
    const resumedOutcome = await new Runtime({
        journalStore: restartedJournalStore
    }).resume({
        runId: "run-123",
        workflow
    })

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
