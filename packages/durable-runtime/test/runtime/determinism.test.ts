import { setTimeout as delay } from "node:timers/promises"
import { expect } from "vitest"

import { FileJournalStore, Runtime, step } from "../../src/index.js"
import { test } from "../fixtures/filesystem.js"
import { defineInputlessWorkflow } from "../fixtures/workflow.js"

test("workflow time does not advance without a durable boundary", async ({ journalDirectory }) => {
    const workflowTimes: number[] = []

    await new Runtime({
        journalStore: new FileJournalStore(journalDirectory)
    }).start(
        defineInputlessWorkflow(async () => {
            workflowTimes.push(Date.now())
            await delay(25)
            workflowTimes.push(Date.now())
        }),
        { runId: "run-123", input: null }
    )

    expect(workflowTimes[1]).toBe(workflowTimes[0])
})

test("workflow time advances after a long-running step completes", async ({ journalDirectory }) => {
    const journalStore = new FileJournalStore(journalDirectory)
    const workflowTimes: number[] = []
    const stepTimes: number[] = []

    await new Runtime({ journalStore }).start(
        defineInputlessWorkflow(async () => {
            workflowTimes.push(Date.now())

            await step({
                name: "long-running-task",
                input: null,
                run: async () => {
                    stepTimes.push(Date.now())
                    await delay(25)
                    stepTimes.push(Date.now())
                    return null
                }
            })

            workflowTimes.push(Date.now())
        }),
        { runId: "run-123", input: null }
    )

    const [runStartedEvent] = await journalStore.listByType({
        runId: "run-123",
        eventType: "run.started"
    })
    const [stepCompletedEvent] = await journalStore.listByType({
        runId: "run-123",
        eventType: "step.completed"
    })

    if (runStartedEvent?.type !== "run.started") throw new Error("Expected a run.started event")
    if (stepCompletedEvent?.type !== "step.completed") throw new Error("Expected a step.completed event")

    expect(stepTimes[1]! - stepTimes[0]!).toBeGreaterThanOrEqual(20)
    expect(workflowTimes).toEqual([Date.parse(runStartedEvent.startedAt), Date.parse(stepCompletedEvent.completedAt)])
})
