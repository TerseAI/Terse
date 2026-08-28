import { expect, expectTypeOf } from "vitest"
import { z } from "zod"

import { FileJournalStore, Runtime, defineHook, waitFor } from "../../src/index.js"
import { test } from "../fixtures/filesystem.js"
import { defineInputlessWorkflow } from "../fixtures/workflow.js"

const ApprovalRequestSchema = z
    .object({
        message: z.string()
    })
    .strict()

const ApprovalResolutionSchema = z
    .object({
        approved: z.boolean(),
        approvedBy: z.string()
    })
    .strict()

type ApprovalRequest = z.infer<typeof ApprovalRequestSchema>
type ApprovalResolution = z.infer<typeof ApprovalResolutionSchema>

function createApprovalHook() {
    return defineHook({
        name: "approval",
        request: ApprovalRequestSchema,
        resolution: ApprovalResolutionSchema
    })
}

test("gets the active suspension until its wait is resolved", async ({ journalDirectory }) => {
    const ApprovalHook = createApprovalHook()
    const journalStore = new FileJournalStore(journalDirectory)
    const workflow = defineInputlessWorkflow(async () => {
        await waitFor(ApprovalHook, {
            message: "Deploy to production?"
        })
    })
    const runtime = new Runtime({ journalStore })

    const firstOutcome = await runtime.start({
        runId: "run-123",
        input: null,
        workflow
    })

    if (firstOutcome.status !== "suspended") throw new Error("Expected the workflow to be suspended")
    expect(await runtime.getSuspension({ runId: "run-123" })).toEqual(firstOutcome.suspension)

    await runtime.resumeHook(ApprovalHook, {
        runId: "run-123",
        workflow,
        waitId: firstOutcome.suspension.waitId,
        resolution: {
            approved: true,
            approvedBy: "Ada"
        }
    })

    expect(await runtime.getSuspension({ runId: "run-123" })).toBeUndefined()
})

test("waitFor suspends a workflow and returns its validated resolution", async ({ journalDirectory }) => {
    const ApprovalHook = createApprovalHook()
    const journalStore = new FileJournalStore(journalDirectory)
    let resolution: ApprovalResolution | undefined
    const workflow = defineInputlessWorkflow(async () => {
        const value = await waitFor(ApprovalHook, {
            message: "Deploy to production?"
        })

        expectTypeOf(value).toEqualTypeOf<ApprovalResolution>()
        resolution = value
    })

    const firstOutcome = await new Runtime({ journalStore }).start({
        runId: "run-123",
        input: null,
        workflow
    })

    expect(resolution).toBeUndefined()
    expect(firstOutcome).toMatchObject({
        status: "suspended",
        suspension: {
            request: {
                type: "hook",
                name: "approval",
                payload: {
                    message: "Deploy to production?"
                }
            }
        }
    })
    if (firstOutcome.status !== "suspended") throw new Error("Expected the workflow to be suspended")

    const resumedOutcome = await new Runtime({ journalStore }).resumeHook(ApprovalHook, {
        runId: "run-123",
        workflow,
        waitId: firstOutcome.suspension.waitId,
        resolution: {
            approved: true,
            approvedBy: "Ada"
        }
    })

    expect(resumedOutcome).toEqual({ status: "completed" })
    expect(resolution).toEqual({
        approved: true,
        approvedBy: "Ada"
    })
})

test("waitFor rejects an invalid request before journaling it", async ({ journalDirectory }) => {
    const ApprovalHook = createApprovalHook()
    const journalStore = new FileJournalStore(journalDirectory)
    const invalidRequest = {
        message: 123
    } as unknown as ApprovalRequest

    await expect(
        new Runtime({ journalStore }).start({
            runId: "run-123",
            input: null,
            workflow: defineInputlessWorkflow(async () => {
                await waitFor(ApprovalHook, invalidRequest)
            })
        })
    ).rejects.toBeInstanceOf(z.ZodError)

    expect(await journalStore.listByType({ runId: "run-123", eventType: "wait.requested" })).toHaveLength(0)
})

test("waitFor rejects an invalid resolution without journaling it", async ({ journalDirectory }) => {
    const ApprovalHook = createApprovalHook()
    const journalStore = new FileJournalStore(journalDirectory)
    const invalidResolution = {
        approved: "yes",
        approvedBy: "Ada"
    } as unknown as ApprovalResolution
    let resolution: ApprovalResolution | undefined
    const workflow = defineInputlessWorkflow(async () => {
        resolution = await waitFor(ApprovalHook, {
            message: "Deploy to production?"
        })
    })
    const firstOutcome = await new Runtime({ journalStore }).start({
        runId: "run-123",
        input: null,
        workflow
    })

    if (firstOutcome.status !== "suspended") throw new Error("Expected the workflow to be suspended")

    await expect(
        new Runtime({ journalStore }).resumeHook(ApprovalHook, {
            runId: "run-123",
            workflow,
            waitId: firstOutcome.suspension.waitId,
            resolution: invalidResolution
        })
    ).rejects.toBeInstanceOf(z.ZodError)

    expect(await journalStore.listByType({ runId: "run-123", eventType: "wait.resolved" })).toHaveLength(0)

    const resumedOutcome = await new Runtime({ journalStore }).resumeHook(ApprovalHook, {
        runId: "run-123",
        workflow,
        waitId: firstOutcome.suspension.waitId,
        resolution: {
            approved: true,
            approvedBy: "Ada"
        }
    })

    expect(resumedOutcome).toEqual({ status: "completed" })
    expect(resolution).toEqual({
        approved: true,
        approvedBy: "Ada"
    })
})
