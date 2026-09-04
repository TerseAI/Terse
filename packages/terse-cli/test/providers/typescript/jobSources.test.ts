import assert from "node:assert/strict"
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import { prepareJobSources } from "../../../src/providers/typescript/jobSources.js"

test("prepares an importable transformed source tree without changing the project", async t => {
    const cwd = await mkdtemp(join(tmpdir(), "terse-job-sources-"))
    t.after(async () => {
        const { rm } = await import("node:fs/promises")
        await rm(cwd, { recursive: true, force: true })
    })

    const sourceDirectory = join(cwd, "src")
    await mkdir(sourceDirectory, { recursive: true })
    const entryFile = join(sourceDirectory, "terse.jobs.ts")
    const source = `
import { createJob, step } from "terse-sdk"

createJob({
    name: "send-message",
    durable: true,
    onTrigger: async event => step(client.send(event.payload.message))
})
`
    await writeFile(entryFile, source)

    const preparedEntry = prepareJobSources({ cwd, entryFile: "src/terse.jobs.ts" })

    assert.equal(await readFile(entryFile, "utf8"), source)
    assert.equal(preparedEntry, join(cwd, ".terse", "runtime", "src", "terse.jobs.ts"))
    const preparedSource = await readFile(preparedEntry, "utf8")
    assert.match(preparedSource, /__runDurableStep/)
    assert.doesNotMatch(preparedSource, /use workflow|use step/)
})

test("transforms step calls in imported source files, not only the job entry", async t => {
    const cwd = await mkdtemp(join(tmpdir(), "terse-job-sources-"))
    t.after(async () => {
        const { rm } = await import("node:fs/promises")
        await rm(cwd, { recursive: true, force: true })
    })

    const sourceDirectory = join(cwd, "src")
    await mkdir(sourceDirectory, { recursive: true })
    await writeFile(
        join(sourceDirectory, "terse.jobs.ts"),
        `
import { createJob } from "terse-sdk"
import { sendMessage } from "./send-message.js"

createJob({ name: "send-message", durable: true, onTrigger: sendMessage })
`
    )
    const helperFile = join(sourceDirectory, "send-message.ts")
    const helperSource = `
import { step } from "terse-sdk"

export async function sendMessage(event) {
    await step(client.send(event.payload.message))
}
`
    await writeFile(helperFile, helperSource)

    prepareJobSources({ cwd, entryFile: "src/terse.jobs.ts" })

    assert.equal(await readFile(helperFile, "utf8"), helperSource)
    assert.match(await readFile(join(cwd, ".terse", "runtime", "src", "send-message.ts"), "utf8"), /__runDurableStep/)
})
