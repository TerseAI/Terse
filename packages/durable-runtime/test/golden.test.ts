import { setTimeout as delay } from "node:timers/promises"
import { expect } from "vitest"

import { FileJournalStore, Runtime, sleep, step } from "../src/index.js"

import { test } from "./fixtures/filesystem.js"
import { defineInputlessWorkflow } from "./fixtures/workflow.js"

test("resumes a workflow without rerunning completed steps", async ({ journalDirectory }) => {
    let createGreetingExecutions = 0
    let sendGreetingExecutions = 0
    const sentGreetings: string[] = []
    const workflow = defineInputlessWorkflow(async () => {
        const greeting = await step({
            name: "create-greeting",
            input: {
                person: "Ada"
            },
            run: async input => {
                createGreetingExecutions++
                return `Hello, ${input.person}`
            }
        })

        await sleep("20ms")

        await step({
            name: "send-greeting",
            input: {
                greeting
            },
            run: async input => {
                sendGreetingExecutions++
                sentGreetings.push(input.greeting)
                return "sent"
            }
        })
    })
    const journalStore = new FileJournalStore(journalDirectory)
    const firstOutcome = await new Runtime({ journalStore }).start({
        runId: "run-123",
        workflowName: "test-workflow",
        input: null,
        workflow
    })

    if (firstOutcome.status !== "suspended") throw new Error("Expected the workflow to be suspended")

    await delay(35)

    const resumedOutcome = await new Runtime({ journalStore }).resumeTimer({
        runId: "run-123",
        workflow,
        waitId: firstOutcome.suspension.waitId
    })

    expect(resumedOutcome).toEqual({ status: "completed" })
    expect(createGreetingExecutions).toBe(1)
    expect(sendGreetingExecutions).toBe(1)
    expect(sentGreetings).toEqual(["Hello, Ada"])
    expect(await journalStore.listByType({ runId: "run-123", eventType: "step.started" })).toHaveLength(2)
    expect(await journalStore.listByType({ runId: "run-123", eventType: "step.completed" })).toHaveLength(2)
    expect(await journalStore.listByType({ runId: "run-123", eventType: "wait.requested" })).toHaveLength(1)
    expect(await journalStore.listByType({ runId: "run-123", eventType: "wait.resolved" })).toHaveLength(1)
    expect(await journalStore.listByType({ runId: "run-123", eventType: "run.completed" })).toHaveLength(1)
})
