import { FileJournalStore, Runtime, waitFor } from "@terse/durable"
import assert from "node:assert/strict"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { __defineTerseWorkflow, __inputRequestHook, __runDurableStep } from "terse-sdk"
import type { CreateJobParameters, TerseJobContext } from "terse-sdk"
import { runWithJobContext } from "terse-sdk/dist/runIdentity/jobContextStore.js"
import type { SerializedEvent } from "terse-types"

import { shouldRunTerseWorkflow } from "../../../src/providers/typescript/terseWorkflow.js"

test("runs, suspends, and resumes a Terse job directly from its journal", async t => {
    const journalDirectory = await mkdtemp(join(tmpdir(), "terse-durable-runtime-"))
    t.after(() => rm(journalDirectory, { recursive: true, force: true }))

    const journalStore = new FileJournalStore(journalDirectory)
    const runtime = new Runtime({ journalStore })
    let stepExecutions = 0
    let voidStepExecutions = 0
    let filterExecutions = 0
    const completed: unknown[] = []

    const job = {
        name: "approval-job",
        triggers: [],
        durable: true,
        filter: async () => {
            filterExecutions += 1
            return true
        },
        onTrigger: async () => {
            const greeting = await __runDurableStep({
                name: "create-greeting",
                input: { person: "Ada" },
                run: async input => {
                    stepExecutions += 1
                    return `Hello, ${input.person}!`
                }
            })
            const voidResult = await __runDurableStep({
                name: "send-notification",
                input: null,
                run: async () => {
                    voidStepExecutions += 1
                }
            })
            assert.equal(voidResult, undefined)
            const approval = await waitFor(__inputRequestHook, { token: "approval-123" })
            completed.push({ greeting, approval })
        }
    } as unknown as CreateJobParameters

    const event = serializedEvent()
    const context = jobContext()
    assert.equal(await shouldRunTerseWorkflow({ job, event, context }), true)
    const workflow = __defineTerseWorkflow(job)
    const firstOutcome = await runWithJobContext(context, () => runtime.start(workflow, { runId: "run-123", input: event }))

    assert.equal(firstOutcome.status, "suspended")
    assert.equal(filterExecutions, 1)
    assert.equal(stepExecutions, 1)
    assert.equal(voidStepExecutions, 1)
    assert.deepEqual(completed, [])

    const suspension = await runtime.getSuspension({ runId: "run-123" })
    assert.ok(suspension)
    assert.equal(suspension.request.name, __inputRequestHook.name)
    assert.deepEqual(__inputRequestHook.request.parse(suspension.request.payload), { token: "approval-123" })
    const resolution = __inputRequestHook.resolution.parse({
        choice: "approve",
        respondent: { provider: "slack", userId: "user-123", displayName: "Ada" }
    })
    const secondOutcome = await runWithJobContext(context, () =>
        runtime.resumeHook(__inputRequestHook, {
            runId: "run-123",
            workflow,
            waitId: suspension.waitId,
            resolution
        })
    )

    assert.equal(secondOutcome.status, "completed")
    assert.equal(filterExecutions, 1)
    assert.equal(stepExecutions, 1)
    assert.equal(voidStepExecutions, 1)
    assert.deepEqual(completed, [
        {
            greeting: "Hello, Ada!",
            approval: {
                choice: "approve",
                respondent: { provider: "slack", userId: "user-123", displayName: "Ada" }
            }
        }
    ])
    assert.deepEqual(
        (await journalStore.list({ runId: "run-123" })).map(event => event.type),
        ["run.started", "step.started", "step.completed", "step.started", "step.completed", "wait.requested", "wait.resolved", "run.completed"]
    )
})

function jobContext(): TerseJobContext {
    return {
        sessionId: "session-123",
        runId: "run-123",
        apiBaseUrl: "https://api.example.com",
        jobName: "approval-job"
    }
}

function serializedEvent(): SerializedEvent {
    return {
        integrationType: "webhook",
        eventType: "webhook",
        formattedContent: "test event",
        debugLog: "test event",
        triggeredAt: "2026-08-26T12:00:00.000Z",
        data: {
            integrationType: "webhook",
            eventType: "webhook",
            body: {},
            headers: {},
            method: "POST"
        }
    }
}
