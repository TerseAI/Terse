import { setTimeout as delay } from "node:timers/promises"
import { expect } from "vitest"

import { FileJournalStore, Runtime, sleep, step } from "../../src/index.js"
import { test } from "../fixtures/filesystem.js"

test("workflow randomness is deterministic when replayed", async ({ journalDirectory }) => {
    const samples: number[][] = []
    const workflow = async () => {
        samples.push([Math.random(), Math.random()])
        await sleep("20ms")
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

    await new Runtime({ journalStore }).resumeTimer({
        runId: "run-123",
        workflow,
        waitId: firstOutcome.suspension.waitId
    })

    expect(samples).toHaveLength(2)
    expect(samples[1]).toEqual(samples[0])
})

test("step randomness remains native when a step is retried", async ({ journalDirectory }) => {
    const stepError = new Error("retry step")
    const samples: number[] = []
    const workflow = async () => {
        await step({
            name: "random-step",
            input: null,
            run: async () => {
                samples.push(Math.random())
                if (samples.length === 1) throw stepError
                return null
            }
        })
    }
    const journalStore = new FileJournalStore(journalDirectory)

    await expect(
        new Runtime({ journalStore }).start({
            runId: "run-123",
            workflowName: "test-workflow",
            input: null,
            workflow
        })
    ).rejects.toBe(stepError)

    await new Runtime({ journalStore }).resume({
        runId: "run-123",
        workflow
    })

    expect(samples).toHaveLength(2)
    expect(samples[1]).not.toBe(samples[0])
})
