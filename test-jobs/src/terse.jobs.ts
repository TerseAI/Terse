import { query } from "@anthropic-ai/claude-agent-sdk"
import { randomFillSync } from "node:crypto"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { createJob, generateText, jobStep, log, slack, sleep, step, waitForInput } from "terse-sdk"
import { z } from "zod"

import { SlackChannel, Triggers, toolbox } from "./terse.generated"

// `createJob` registers a job with Terse. Each job has a name, one or more
// triggers, and an `onTrigger` handler. `terse test` and `terse run` execute
// them locally.
createJob({
    name: "Tell a programming joke example job",

    // This is where you configure what events will fire this job.
    triggers: [Triggers.schedule.cron({ expression: "0 9 * * 1" })],

    states: [{ key: "runCount", value: z.number().default(0) }],
    durable: true,
    // The handler runs every time a trigger fires. `event` is typed to match
    // the trigger(s) above.
    onTrigger: async (event, state) => {
        const response = await generateText({
            prompt: "Tell me a joke about Lord of the rings. With Gandalf in it",
            skills: [],
            outputSchema: z.object({ joke: z.string() })
        })

        await toolbox.slack.sendMessage({
            channelId: SlackChannel.AllTerseInc.channelId,
            message: response.joke
        })

        const runCount = await state.get("runCount")
        await state.set("runCount", runCount + 1)

        const work = await jobStep({
            input: runCount,
            inputSchema: z.number(),
            outputSchema: z.string(),
            run: async (runCount: number) => {
                console.log("Run count: ", runCount)
                console.log("pretend there is a lot of work happening here.")

                return "work is done " + runCount
            }
        })

        // console.log(work)

        const result = await waitForInput({
            via: slack({ channel: SlackChannel.AllTerseInc.channelId }),
            prompt: "What is the meaning of life?",
            details: {
                test: "This is a test of the waitForInput function"
            },
            options: [
                { id: "approve", label: "Approve" },
                { id: "reject", label: "Reject" },
                { id: "changes", label: "Request changes", freeText: true }
            ]
        })

        if (result.choice === "approve") {
            await toolbox.slack.sendMessage({
                channelId: SlackChannel.AllTerseInc.channelId,
                message: "this job is approved!"
            })
        } else if (result.choice === "changes") {
            const changes = result.text ?? ""
            await toolbox.slack.sendMessage({
                channelId: SlackChannel.AllTerseInc.channelId,
                message: "this job needs changes!" + changes
            })
        } else {
            await toolbox.slack.sendMessage({
                channelId: SlackChannel.AllTerseInc.channelId,
                message: "this job is rejected!"
            })
        }

        console.log("sleeping for 1 minute")
        await sleep("1m")
        console.log("sleep completed")

        console.log(response.joke)
    }
})

// Ready to ship? Run `terse deploy` to push this job to Terse so its triggers
// start firing in the cloud. Re-run it any time you change a job.

createJob({
    name: "Basic Test - Hello World",
    triggers: [Triggers.schedule.cron({ expression: "0 9 * * 1" })],
    onTrigger: async event => {
        console.log("Hello, world!")
    }
})

createJob({
    name: "Basic Test - Failure, sleep() on non durable job",
    triggers: [Triggers.schedule.cron({ expression: "0 9 * * 1" })],
    onTrigger: async event => {
        console.log("trying to sleep in non durable job")
        await sleep(1000)
        console.log("sleep in non durable job completed")
    }
})

createJob({
    name: "Basic Test - Failure, waitForInput() on non durable job",
    triggers: [Triggers.schedule.cron({ expression: "0 9 * * 1" })],
    onTrigger: async event => {
        console.log("trying to waitForInput in non durable job")
        await waitForInput({
            via: slack({ channel: SlackChannel.AllTerseInc.channelId }),
            prompt: "What is the meaning of life?",
            options: [
                { id: "approve", label: "Approve" },
                { id: "reject", label: "Reject" },
                { id: "changes", label: "Request changes", freeText: true }
            ]
        })
    }
})

createJob({
    name: "Basic Test - Failure, jobStep() on non durable job",
    triggers: [Triggers.schedule.cron({ expression: "0 9 * * 1" })],
    onTrigger: async event => {
        console.log("trying to jobStep in non durable job")
        await jobStep({
            input: "test",
            inputSchema: z.string(),
            outputSchema: z.string(),
            run: async (input: string) => {
                console.log("jobStep in non durable job completed")
                return "work is done " + input
            }
        })
    }
})

async function fetchTodo(id: number) {
    console.log("fetching todo", id)
    const response = await fetch(`https://jsonplaceholder.typicode.com/todos/${id}`)
    let json = await response.json()
    console.log("todo", json)
    return json
}

createJob({
    name: "Basic Test - step macro",
    triggers: [Triggers.schedule.cron({ expression: "0 9 * * 1" })],
    durable: true,
    onTrigger: async event => {
        const todo = await step(fetchTodo(1))

        const todo2 = await step(fetchTodo(2))

        const todo3 = await step(fetchTodo(3))
    }
})

createJob({
    name: "Basic Test - Success. sleep in durable job works",
    triggers: [Triggers.schedule.cron({ expression: "0 9 * * 1" })],
    durable: true,
    onTrigger: async event => {
        console.log("trying to sleep in durable job")
        await sleep("2m")
        console.log("sleep in durable job completed")
    }
})

createJob({
    name: "Basic Test - Slack Mention",
    triggers: [Triggers.slack.onAppMention({ channel: SlackChannel.AllTerseInc })],
    durable: true,
    onTrigger: async event => {
        console.log("Slack mention received", event)
    }
})

// ─────────────── FS snapshot suspension tests (TER-713) ───────────────
//
// Handlers pass plain strings and never touch fs/path/os: Node modules are only
// legal inside step callees, which run outside the workflow sandbox.
//
// Every write goes inside step() so it runs exactly once. On resume the step
// replays from the journal without re-executing, so the file exists after
// resume only if the filesystem itself was restored. Writing outside a step
// would recreate the file on replay and pass even with no restore at all.
//
// The reads are steps too: declared after the sleep, they are unjournaled at
// suspend time and so execute fresh on resume.

createJob({
    name: "FS Snapshot - Timer suspend preserves file edits",
    triggers: [Triggers.schedule.cron({ expression: "0 9 * * 1" })],
    durable: true,
    onTrigger: async () => {
        const expected = await step(writeMarker("timer-marker.txt", "timer"))

        await sleep("1m")

        const actual = await step(readMarker("timer-marker.txt"))
        assertEquals(actual, expected, "file written before a timer suspend")
        await log("PASS: timer suspend preserved the file", { actual })
    }
})

createJob({
    name: "FS Snapshot - Input suspend preserves file edits",
    triggers: [Triggers.schedule.cron({ expression: "0 9 * * 1" })],
    durable: true,
    onTrigger: async () => {
        const expected = await step(writeMarker("input-marker.txt", "input"))

        await waitForInput({
            via: slack({ channel: SlackChannel.AllTerseInc.channelId }),
            prompt: "FS snapshot test: approve to resume and verify the file survived",
            options: [{ id: "approve", label: "Approve" }]
        })

        const actual = await step(readMarker("input-marker.txt"))
        assertEquals(actual, expected, "file written before an input suspend")
        await log("PASS: input suspend preserved the file", { actual })
    }
})

createJob({
    name: "FS Snapshot - Writes outside the project dir",
    triggers: [Triggers.schedule.cron({ expression: "0 9 * * 1" })],
    durable: true,
    onTrigger: async () => {
        const expectedTmp = await step(writeMarkerOutsideProject("tmp"))
        const expectedHome = await step(writeMarkerOutsideProject("home"))

        await sleep("1m")

        const actualTmp = await step(readMarkerOutsideProject("tmp"))
        const actualHome = await step(readMarkerOutsideProject("home"))
        assertEquals(actualTmp, expectedTmp, "file written to the temp dir")
        assertEquals(actualHome, expectedHome, "file written to the home dir")
        await log("PASS: writes outside the project dir survived", { actualTmp, actualHome })
    }
})

createJob({
    name: "FS Snapshot - Deletion survives resume",
    triggers: [Triggers.schedule.cron({ expression: "0 9 * * 1" })],
    durable: true,
    onTrigger: async () => {
        await step(writeMarker("doomed.txt", "doomed"))
        await sleep("1m")

        const fileWritten = await step(readMarker("doomed.txt"))
        if (fileWritten === null) {
            throw new Error("File did not survive the first suspend, so the deletion case never got exercised")
        }

        // The file now lives in the first suspension's layer. Deleting it here means
        // the second layer has to record the removal, not just omit the file.
        await step(deleteMarker("doomed.txt"))
        await sleep("1m")

        const actual = await step(readMarker("doomed.txt"))
        if (actual !== null) {
            throw new Error(`Deleted file came back after resume, contains: ${actual}`)
        }
        await log("PASS: deletion survived the resume")
    }
})

createJob({
    name: "FS Snapshot - Layer depth, 10 stacked suspends",
    triggers: [Triggers.schedule.cron({ expression: "0 9 * * 1" })],
    durable: true,
    onTrigger: async () => {
        const rounds = 10

        for (let round = 0; round < rounds; round++) {
            await step(appendLine("layers.txt", `round-${round}`))
            await sleep("30s")

            const lines = await step(countLines("layers.txt"))
            assertEquals(String(lines), String(round + 1), `line count after resume ${round}`)
            await log(`PASS: layer ${round + 1}/${rounds} intact`, { lines })
        }
    }
})

createJob({
    name: "FS Snapshot - Large diff, 64MB before suspend",
    triggers: [Triggers.schedule.cron({ expression: "0 9 * * 1" })],
    durable: true,
    onTrigger: async () => {
        const megabytes = 64
        const expectedBytes = await step(writeLargeFile("large-blob.bin", megabytes))

        await sleep("1m")

        const actualBytes = await step(fileSize("large-blob.bin"))
        assertEquals(String(actualBytes), String(expectedBytes), `${megabytes}MB file written before suspend`)
        await log("PASS: large file survived the suspend", { bytes: actualBytes })
    }
})

createJob({
    name: "Basic Test - Claude Code SDK in a durable job",
    triggers: [Triggers.schedule.cron({ expression: "0 9 * * 1" })],
    durable: true,
    onTrigger: async () => {
        const survey = await step(runClaudeCode("Summarize in two sentences what this project is."))

        await log("claude code survey:", survey.text)
        await log(`turns: ${survey.turns}, cost: $${survey.costUsd}`)

        // The sleep suspends the run. On resume the step above replays from the
        // journal instead of re-running Claude Code, and the follow-up picks the
        // same Claude Code session back up.
        await sleep("2m")

        const followUp = await step(runClaudeCode("Now name the single riskiest file in that project and say why.", survey.sessionId))

        await log("claude code follow-up after resume:", followUp.text)
    }
})

// ─────────────── helpers ───────────────
//
// Everything below runs inside step functions, where Node modules are available.

function assertEquals(actual: string | null, expected: string, what: string): void {
    if (actual !== expected) {
        throw new Error(`${what}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
    }
}

function testFilePath(name: string): string {
    return path.join(process.cwd(), "fs-snapshot-tests", name)
}

function outsideProjectPath(location: "tmp" | "home"): string {
    const dir = location === "tmp" ? os.tmpdir() : os.homedir()
    return path.join(dir, "terse-fs-snapshot-test.txt")
}

async function writeMarker(name: string, label: string): Promise<string> {
    const file = testFilePath(name)
    const contents = `${label}-${Date.now()}`
    await fs.mkdir(path.dirname(file), { recursive: true })
    await fs.writeFile(file, contents)
    console.log("wrote marker", { file, contents })
    return contents
}

async function readMarker(name: string): Promise<string | null> {
    return fs.readFile(testFilePath(name), "utf8").catch(() => null)
}

async function deleteMarker(name: string): Promise<string> {
    const file = testFilePath(name)
    await fs.rm(file, { force: true })
    console.log("deleted file", { file })
    return file
}

async function writeMarkerOutsideProject(location: "tmp" | "home"): Promise<string> {
    const file = outsideProjectPath(location)
    const contents = `${location}-${Date.now()}`
    await fs.writeFile(file, contents)
    console.log("wrote marker outside the project dir", { file, contents })
    return contents
}

async function readMarkerOutsideProject(location: "tmp" | "home"): Promise<string | null> {
    return fs.readFile(outsideProjectPath(location), "utf8").catch(() => null)
}

async function appendLine(name: string, line: string): Promise<string> {
    const file = testFilePath(name)
    await fs.mkdir(path.dirname(file), { recursive: true })
    await fs.appendFile(file, `${line}\n`)
    console.log("appended line", { file, line })
    return line
}

async function countLines(name: string): Promise<number> {
    const contents = await readMarker(name)
    return contents === null ? 0 : contents.trimEnd().split("\n").length
}

async function fileSize(name: string): Promise<number> {
    const stat = await fs.stat(testFilePath(name)).catch(() => null)
    return stat?.size ?? 0
}

async function runClaudeCode(prompt: string, resumeSessionId?: string) {
    let text = ""
    let sessionId = resumeSessionId ?? ""
    let turns = 0
    let costUsd = 0

    for await (const message of query({
        prompt,
        options: {
            model: "claude-sonnet-5",
            resume: resumeSessionId,
            allowedTools: ["Read", "Glob", "Grep"],
            permissionMode: "bypassPermissions",
            // Sandboxes run as root, and the CLI refuses bypassPermissions as root
            // unless it is told it is already sandboxed.
            env: { ...process.env, IS_SANDBOX: "1" },
            // The SDK reports a non-zero exit without the child's own message.
            stderr: data => console.error("[claude-code stderr]", data)
        }
    })) {
        if (message.type !== "result") continue

        sessionId = message.session_id
        turns = message.num_turns
        costUsd = message.total_cost_usd
        if (message.subtype !== "success") throw new Error(`Claude Code failed: ${message.subtype}`)
        text = message.result
    }

    return { text, sessionId, turns, costUsd }
}

async function writeLargeFile(name: string, megabytes: number): Promise<number> {
    const file = testFilePath(name)
    await fs.mkdir(path.dirname(file), { recursive: true })
    // Random bytes so the layer can't be compressed or deduplicated into nothing.
    const chunk = Buffer.alloc(1024 * 1024)
    const handle = await fs.open(file, "w")
    try {
        for (let written = 0; written < megabytes; written++) {
            randomFillSync(chunk)
            await handle.write(chunk)
        }
    } finally {
        await handle.close()
    }
    const bytes = megabytes * 1024 * 1024
    console.log("wrote large file", { file, bytes })
    return bytes
}
