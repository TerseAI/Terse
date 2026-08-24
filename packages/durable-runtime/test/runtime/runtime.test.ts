import { stat } from "node:fs/promises"
import { join } from "node:path"
import { expect } from "vitest"

import { FileJournalStore, Runtime } from "../../src/index.js"
import { test } from "../fixtures/filesystem.js"

test("starting a workflow creates its run directory", async ({ journalDirectory }) => {
    const runtime = new Runtime({
        journalStore: new FileJournalStore(journalDirectory)
    })

    await runtime.start({
        workflow: async () => {
            console.log("Hello World")
        },
        runId: "run-123",
        workflowName: "test-workflow",
        input: null
    })

    const runDirectory = await stat(join(journalDirectory, "run-123"))

    expect(runDirectory.isDirectory()).toBe(true)
})
