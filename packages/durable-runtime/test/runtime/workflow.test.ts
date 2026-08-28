import { expect } from "vitest"
import { z } from "zod"

import { FileJournalStore, Runtime, defineHook, defineWorkflow, waitFor } from "../../src/index.js"
import { test } from "../fixtures/filesystem.js"

test("a workflow definition restores its typed input from the journal on resume", async ({ journalDirectory }) => {
    const ApprovalHook = defineHook({
        name: "approval",
        request: z.object({ message: z.string() }).strict(),
        resolution: z.object({ approved: z.boolean() }).strict()
    })
    const receivedDates: Date[] = []
    const workflow = defineWorkflow({
        name: "test-workflow",
        input: z
            .object({ occurredAt: z.iso.datetime() })
            .strict()
            .transform(input => ({ occurredAt: new Date(input.occurredAt) })),
        run: async input => {
            receivedDates.push(input.occurredAt)
            await waitFor(ApprovalHook, { message: "Continue?" })
        }
    })
    const runtime = new Runtime({ journalStore: new FileJournalStore(journalDirectory) })

    const firstOutcome = await runtime.start({
        runId: "run-123",
        input: { occurredAt: "2026-08-26T12:00:00.000Z" },
        workflow
    })

    if (firstOutcome.status !== "suspended") throw new Error("Expected the workflow to be suspended")

    await runtime.resumeHook(ApprovalHook, {
        runId: "run-123",
        workflow,
        waitId: firstOutcome.suspension.waitId,
        resolution: { approved: true }
    })

    expect(receivedDates).toHaveLength(2)
    expect(receivedDates.every(value => value instanceof Date)).toBe(true)
    expect(receivedDates.map(value => value.toISOString())).toEqual(["2026-08-26T12:00:00.000Z", "2026-08-26T12:00:00.000Z"])
})

test("invalid workflow input is rejected before the run is recorded", async ({ journalDirectory }) => {
    const journalStore = new FileJournalStore(journalDirectory)
    const runtime = new Runtime({ journalStore })
    const workflow = defineWorkflow({
        name: "test-workflow",
        input: z.object({ message: z.string().min(1) }).strict(),
        run: async () => undefined
    })

    await expect(
        runtime.start({
            runId: "run-123",
            input: { message: "" },
            workflow
        })
    ).rejects.toBeInstanceOf(z.ZodError)

    expect(await journalStore.list({ runId: "run-123" })).toEqual([])
})
