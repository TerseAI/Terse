import { expect } from "vitest"

import { FileJournalStore, Runtime, sleep } from "../../src/index.js"
import { test } from "../fixtures/filesystem.js"

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
