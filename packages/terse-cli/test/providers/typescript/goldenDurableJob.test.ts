import { FileJournalStore, Runtime } from "@terse/durable"
import assert from "node:assert/strict"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import test from "node:test"
import { fileURLToPath, pathToFileURL } from "node:url"
import { __fetchRegisteredDurableWorkflow, __resetRegisteredTerseInstances, fetchRegisteredJobs } from "terse-sdk"
import type { TerseJobContext } from "terse-sdk"
import { runWithJobContext } from "terse-sdk/dist/runIdentity/jobContextStore.js"
import type { SerializedEvent } from "terse-types"
import { tsImport } from "tsx/esm/api"

import { prepareJobSources } from "../../../src/providers/typescript/jobSources.js"

test("loads and executes a transformed durable job without building a bundle", async t => {
    const packageDirectory = fileURLToPath(new URL("../../../", import.meta.url))
    const cwd = await mkdtemp(join(packageDirectory, ".golden-durable-project-"))
    t.after(() => rm(cwd, { recursive: true, force: true }))
    await mkdir(join(cwd, "src"), { recursive: true })
    await writeFile(join(cwd, "package.json"), JSON.stringify({ name: "durable-fixture", type: "module" }))
    await writeFile(
        join(cwd, "src", "terse.jobs.ts"),
        `
import { createJob, step } from "terse-sdk"

const client = {
    async send(message: string) {
        globalThis.__goldenStepExecutions = (globalThis.__goldenStepExecutions ?? 0) + 1
        return { message }
    }
}

createJob({
    name: "golden-job",
    triggers: [],
    durable: true,
    onTrigger: async event => {
        const result = await step(client.send(event.formatForAgentRunner()))
        globalThis.__goldenResult = result.message
    }
})
`
    )

    const preparedEntry = prepareJobSources({ cwd, entryFile: "src/terse.jobs.ts" })
    __resetRegisteredTerseInstances()
    await tsImport(pathToFileURL(preparedEntry).href, pathToFileURL(join(cwd, "package.json")).href)

    const job = fetchRegisteredJobs().get("golden-job")
    assert.ok(job)
    const workflow = __fetchRegisteredDurableWorkflow(job.name)
    assert.ok(workflow)
    const journalStore = new FileJournalStore(join(cwd, "journal"))
    const event = serializedEvent()
    const outcome = await runWithJobContext(jobContext(), () =>
        new Runtime({ journalStore }).start(workflow, {
            runId: "run-golden",
            input: event
        })
    )

    assert.deepEqual(outcome, { status: "completed" })
    assert.equal(Reflect.get(globalThis, "__goldenStepExecutions"), 1)
    assert.equal(Reflect.get(globalThis, "__goldenResult"), "test event")
    assert.deepEqual(
        (await journalStore.list({ runId: "run-golden" })).map(event => event.type),
        ["run.started", "step.started", "step.completed", "run.completed"]
    )
})

function jobContext(): TerseJobContext {
    return {
        sessionId: "session-golden",
        runId: "run-golden",
        apiBaseUrl: "https://api.example.com",
        jobName: "golden-job"
    }
}

function serializedEvent(): SerializedEvent {
    return {
        integrationType: "webhook",
        eventType: "webhook",
        formattedContent: "test event",
        debugLog: "test event",
        triggeredAt: "2026-08-26T12:00:00.000Z",
        data: { integrationType: "webhook", eventType: "webhook", body: {}, headers: {}, method: "POST" }
    }
}
