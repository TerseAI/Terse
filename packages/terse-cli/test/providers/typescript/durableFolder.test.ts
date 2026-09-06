import { Runtime, defineWorkflow, sleep, step } from "little-durable"
import assert from "node:assert/strict"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import type { TestContext } from "node:test"
import { DurableObjectJournalStore, __TerseWorkflowJournal } from "terse-sdk"
import { z } from "zod"

import { withDurableFolder, withDurableFolderSync } from "../../../src/providers/typescript/runtimes/durableFolder.js"

function journal() {
    const actor = Reflect.construct(__TerseWorkflowJournal, []) as __TerseWorkflowJournal
    return new DurableObjectJournalStore(() => actor)
}

test("awaits sync before recording completion or executing the next step", async () => {
    const store = journal()
    let releaseSync!: () => void
    let syncStarted!: () => void
    const blockedSync = new Promise<void>(resolve => {
        releaseSync = resolve
    })
    const started = new Promise<void>(resolve => {
        syncStarted = resolve
    })
    let syncs = 0
    let secondStepRan = false
    const runtime = new Runtime({
        journalStore: withDurableFolderSync(store, async () => {
            if (++syncs === 1) {
                syncStarted()
                await blockedSync
            }
        })
    })
    const workflow = defineWorkflow({
        name: "ordering",
        input: z.null(),
        run: async () => {
            await step({ name: "first", input: null, run: async () => "written" })
            await step({
                name: "second",
                input: null,
                run: async () => {
                    secondStepRan = true
                    return null
                }
            })
        }
    })
    const outcome = runtime.start(workflow, { runId: "run", input: null }).waitForOutcome()
    await started
    assert.deepEqual(
        (await store.list({ runId: "run" })).map(event => event.type),
        ["run.started", "step.started"]
    )
    assert.equal(secondStepRan, false)
    releaseSync()
    assert.deepEqual(await outcome, { status: "completed" })
    assert.equal(secondStepRan, true)
    assert.equal(syncs, 3) // Two executed steps and the final run boundary.
})

test("a failed sync leaves the step incomplete; retry keeps partial files and skips completed steps", async t => {
    const folder = await temporaryDirectory(t)
    const draft = join(folder, "draft.txt")
    const store = journal()
    let firstExecutions = 0
    let secondExecutions = 0
    const workflow = defineWorkflow({
        name: "retry",
        input: z.null(),
        run: async () => {
            await step({
                name: "first",
                input: null,
                run: async () => {
                    firstExecutions++
                    await writeFile(draft, "first")
                    return null
                }
            })
            await step({
                name: "second",
                input: null,
                run: async () => {
                    secondExecutions++
                    if (secondExecutions === 2) assert.equal(await readFile(draft, "utf8"), "partial second")
                    await writeFile(draft, secondExecutions === 1 ? "partial second" : "finished second")
                    return null
                }
            })
        }
    })
    let syncs = 0
    const failed = await new Runtime({
        journalStore: withDurableFolderSync(store, async () => {
            if (++syncs === 2) throw new Error("volume unavailable")
        })
    })
        .start(workflow, { runId: "run", input: null })
        .waitForOutcome()
    assert.equal(failed.status, "failed")
    assert.equal((await store.listByType({ runId: "run", eventType: "step.completed" })).length, 1)
    assert.equal((await store.listByType({ runId: "run", eventType: "run.completed" })).length, 0)
    const recovered = await new Runtime({ journalStore: withDurableFolderSync(store, async () => {}) }).resume(workflow, { runId: "run" }).waitForOutcome()
    assert.deepEqual(recovered, { status: "completed" })
    assert.equal(firstExecutions, 1)
    assert.equal(secondExecutions, 2)
    assert.equal(await readFile(draft, "utf8"), "finished second")
})

test("syncs before suspension and after resume without syncing replayed steps", async () => {
    const store = journal()
    let syncs = 0
    let executions = 0
    const synced = withDurableFolderSync(store, async () => {
        syncs++
    })
    const workflow = defineWorkflow({
        name: "wait",
        input: z.null(),
        run: async () => {
            await step({
                name: "write",
                input: null,
                run: async () => {
                    executions++
                    return null
                }
            })
            await sleep("1ms")
        }
    })
    const runtime = new Runtime({ journalStore: synced })
    const first = await runtime.start(workflow, { runId: "run", input: null }).waitForOutcome()
    assert.equal(first.status, "suspended")
    assert.equal(syncs, 2)
    const suspension = await runtime.getSuspension({ runId: "run" })
    assert.ok(suspension)
    const resumed = await new Runtime({ journalStore: synced }).resumeTimer(workflow, { runId: "run", waitId: suspension.waitId }).waitForOutcome()
    assert.equal(resumed.status, "completed")
    assert.equal(syncs, 3)
    assert.equal(executions, 1)
})

test("catching a sync failure cannot let the workflow report completion", async () => {
    const store = journal()
    const workflow = defineWorkflow({
        name: "catch",
        input: z.null(),
        run: async () => {
            try {
                await step({ name: "write", input: null, run: async () => null })
            } catch {}
        }
    })
    const runtime = new Runtime({
        journalStore: withDurableFolderSync(store, async () => {
            throw new Error("sync failed")
        })
    })
    await assert.rejects(runtime.start(workflow, { runId: "run", input: null }).waitForOutcome(), /sync failed/)
    assert.equal((await store.listByType({ runId: "run", eventType: "step.completed" })).length, 0)
    assert.equal((await store.listByType({ runId: "run", eventType: "run.completed" })).length, 0)
})

test("local runs get separate folders, reuse them on resume, and restore the environment", async t => {
    clearFolderEnvironment(t)
    const cwd = await temporaryDirectory(t)
    t.mock.method(process, "cwd", () => cwd)
    let savedPath = ""
    await withDurableFolder("run-a", async folder => {
        savedPath = folder.path
        assert.equal(process.env.TERSE_DURABLE_DIR, folder.path)
        await writeFile(join(folder.path, "draft.txt"), "local draft")
    })
    assert.equal(process.env.TERSE_DURABLE_DIR, undefined)
    await withDurableFolder("run-b", async folder => {
        assert.notEqual(folder.path, savedPath)
        await assert.rejects(readFile(join(folder.path, "draft.txt")), { code: "ENOENT" })
    })
    await assert.rejects(
        withDurableFolder("run-a", async folder => {
            assert.equal(folder.path, savedPath)
            assert.equal(await readFile(join(folder.path, "draft.txt"), "utf8"), "local draft")
            throw new Error("interrupted")
        }),
        /interrupted/
    )
    assert.equal(process.env.TERSE_DURABLE_DIR, undefined)
})

test("a sandbox without configured durable storage fails before running workflow code", async t => {
    clearFolderEnvironment(t)
    process.env.IS_SANDBOX = "1"
    await assert.rejects(
        withDurableFolder("run", async () => assert.fail("must not execute")),
        /no durable folder configured/
    )
})

async function temporaryDirectory(t: TestContext) {
    const directory = await mkdtemp(join(tmpdir(), "terse-durable-folder-"))
    t.after(() => rm(directory, { recursive: true, force: true }))
    return directory
}

function clearFolderEnvironment(t: TestContext) {
    for (const key of ["TERSE_DURABLE_DIR", "TERSE_DURABLE_SYNC", "IS_SANDBOX"]) {
        const previous = process.env[key]
        delete process.env[key]
        t.after(() => {
            if (previous === undefined) delete process.env[key]
            else process.env[key] = previous
        })
    }
}
