import { readdir, stat } from "node:fs/promises"
import { join } from "node:path"
import { expect } from "vitest"

import { FileJournalStore } from "../../src/index.js"
import type { RunStartedEvent } from "../../src/types/runStartedEvent.js"
import { test } from "../fixtures/filesystem.js"

test("writes each journal event to its run directory", async ({ journalDirectory }) => {
    const journalStore = new FileJournalStore(journalDirectory)
    const event: RunStartedEvent = {
        eventId: "run.started",
        type: "run.started",
        workflowName: "test-workflow",
        startedAt: "2026-08-24T15:30:00.000Z",
        input: null
    }

    await journalStore.append({
        runId: "run-123",
        event
    })

    const runDirectory = join(journalDirectory, "run-123")

    expect((await stat(runDirectory)).isDirectory()).toBe(true)
    expect(await readdir(runDirectory)).toEqual(["00000001-run.started.json"])
})
