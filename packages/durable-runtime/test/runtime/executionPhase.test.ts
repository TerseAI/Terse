import { expect } from "vitest"

import { FileJournalStore, Runtime, getExecutionPhase, step } from "../../src/index.js"
import { test } from "../fixtures/filesystem.js"
import { defineInputlessWorkflow } from "../fixtures/workflow.js"

test("reports whether code is outside a workflow, orchestrating, or running a step", async ({ journalDirectory }) => {
    const phases: Array<ReturnType<typeof getExecutionPhase>> = [getExecutionPhase()]

    await new Runtime({
        journalStore: new FileJournalStore(journalDirectory)
    }).start(
        defineInputlessWorkflow(async () => {
            phases.push(getExecutionPhase())

            await step({
                name: "record-phase",
                input: null,
                run: async () => {
                    phases.push(getExecutionPhase())
                    return null
                }
            })
        }),
        { runId: "run-123", input: null }
    )

    phases.push(getExecutionPhase())

    expect(phases).toEqual([undefined, "workflow", "step", undefined])
})
