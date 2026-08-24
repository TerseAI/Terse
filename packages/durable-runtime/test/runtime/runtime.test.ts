import { readdir, stat } from "node:fs/promises"
import { join } from "node:path"
import { expect } from "vitest"

import { FileJournalStore, Runtime } from "../../src/index.js"
import { test } from "../fixtures/filesystem.js"

test("starting a workflow creates its run directory and first journal event", async ({ journalDirectory }) => {
    const journalStore = new FileJournalStore(journalDirectory)
    const runtime = new Runtime({
        journalStore
    })

    await runtime.start({
        workflow: async () => undefined,
        runId: "run-123",
        workflowName: "test-workflow",
        input: null
    })

    const runDirectory = await stat(join(journalDirectory, "run-123"))

    expect(runDirectory.isDirectory()).toBe(true)
    expect(await readdir(join(journalDirectory, "run-123"))).toEqual(["00000001-run.started.json"])
    expect(await journalStore.listByType({ runId: "run-123", eventType: "run.started" })).toHaveLength(1)
})

test("cannot start two workflows with the same run ID", async ({ journalDirectory }) => {
    const runtime = new Runtime({
        journalStore: new FileJournalStore(journalDirectory)
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
    expect(await readdir(join(journalDirectory, "run-123"))).toEqual(["00000001-run.started.json"])
})
