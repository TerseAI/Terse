import chalk from "chalk"
import { CreateJobParameters, TerseAgent } from "terse-sdk"
import { readApiKey } from "./api.js"
import { assertProjectRoot } from "./assertProjectRoot.js"
import { loadJob } from "./loadJob.js"
import { ApiRoutes } from "./shared/ApiRoutes.js"
import type { SerializedEvent } from "./shared/types.js"
import { convertSerializedEventToInputEvent } from "./util.js"

const BACKEND_URL = "http://localhost:3001"

/**
 * Create a TerseAgent scoped to a job's skills and execute onTrigger.
 * Tools are registered from the codegen factory on globalThis (needed because
 * tsx may load a separate module instance of terse-sdk).
 */
export async function executeJob(job: CreateJobParameters, event: SerializedEvent, options?: { verbose?: boolean }): Promise<void> {
    const inputEvent = convertSerializedEventToInputEvent(event)
    const isVerbose = options?.verbose ?? false

    const apiKey = process.env.TERSE_API_KEY ?? null
    let sessionId: string | undefined
    let closeSession: (() => void) | undefined

    if (isVerbose && apiKey) {
        const session = await openSessionStream(apiKey)
        sessionId = session.sessionId
        closeSession = session.close
    }

    const agent = new TerseAgent(job.skills, BACKEND_URL, sessionId)
    const createTools = (globalThis as any).__terse_createTools as ((agent: TerseAgent) => unknown) | undefined
    if (createTools) {
        Object.defineProperty(agent, "tools", { value: createTools(agent) })
    }

    try {
        if (isVerbose) {
            console.log(chalk.cyan(`  Job "${job.name}" started`))
        }
        await job.onTrigger(inputEvent, agent)
        console.log(chalk.green(`\n  Job "${job.name}" completed successfully.\n`))
    } catch (err) {
        console.error(chalk.red(`\n  Job "${job.name}" threw an error:\n`))
        console.error(err)
        process.exit(1)
    } finally {
        closeSession?.()
    }
}

export async function run(jobName?: string, eventJson?: string): Promise<void> {
    assertProjectRoot()

    if (!eventJson) {
        console.error(chalk.red("Error: --event <json> is required.\n"))
        console.error(chalk.dim("  Usage: terse run --event '{\"integrationType\":\"...\",\"formattedContent\":\"...\",\"debugLog\":\"...\"}'"))
        console.error(chalk.dim("  Tip:   Use `terse test` to interactively pick a sample event.\n"))
        process.exit(1)
    }

    readApiKey()
    const { job } = await loadJob(jobName)
    console.log(chalk.cyan(`\n  Running job: ${job.name}\n`))

    let parsed: SerializedEvent
    try {
        parsed = JSON.parse(eventJson) as SerializedEvent
    } catch {
        console.error(chalk.red("Error: --event value is not valid JSON."))
        process.exit(1)
    }

    await executeJob(job, parsed)
}

// -- Session SSE lifecycle --------------------------------------------------

type SessionHandle = { sessionId: string; close: () => void }

async function openSessionStream(apiKey: string): Promise<SessionHandle> {
    const res = await fetch(`${BACKEND_URL}${ApiRoutes.SDK.SESSION_EVENTS}`, {
        headers: { Authorization: `Bearer ${apiKey}`, Accept: "text/event-stream" }
    })

    if (!res.ok || !res.body) {
        throw new Error(`Failed to open session event stream (HTTP ${res.status})`)
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ""

    const sessionId = await readSessionId(reader, decoder, buffer)
    buffer = sessionId._remainingBuffer

    startEventConsumer(reader, decoder, buffer)

    return {
        sessionId: sessionId.value,
        close: () => reader.cancel().catch(() => {})
    }
}

async function readSessionId(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    decoder: TextDecoder,
    buffer: string
): Promise<{ value: string; _remainingBuffer: string }> {
    while (true) {
        const { done, value } = await reader.read()
        if (done) throw new Error("Session stream ended before sending sessionId")
        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""

        for (const line of lines) {
            if (!line.startsWith("data: ")) continue
            const event = safeParseJson(line.slice(6))
            if (event?.type === "session_started" && typeof event.sessionId === "string") {
                return { value: event.sessionId, _remainingBuffer: buffer }
            }
        }
    }
}

function startEventConsumer(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    decoder: TextDecoder,
    initialBuffer: string
): void {
    let buffer = initialBuffer;
    (async () => {
        try {
            while (true) {
                const { done, value } = await reader.read()
                if (done) break
                buffer += decoder.decode(value, { stream: true })

                const lines = buffer.split("\n")
                buffer = lines.pop() ?? ""

                for (const line of lines) {
                    if (!line.startsWith("data: ")) continue
                    const event = safeParseJson(line.slice(6))
                    if (event) logSessionEvent(event)
                }
            }
        } catch {
            // Stream cancelled by close() — expected
        }
    })()
}

function logSessionEvent(event: Record<string, unknown>): void {
    switch (event.type) {
        case "tool_call_started":
            console.log(chalk.blue(`  [tool:start] ${event.toolCallStarted}`))
            break
        case "tool_call_completed": {
            const parsed = safeParseJson(event.toolCallCompleted as string)
            const toolName = parsed?.tool || "unknown_tool"
            const status = parsed?.status || "unknown"
            const symbol = status === "completed" ? chalk.green("ok") : chalk.red("failed")
            console.log(`  [tool:done] ${toolName} (${symbol})`)
            break
        }
        case "action": {
            const action = event.action as Record<string, unknown> | undefined
            const actionName = (action?.action as string) || "action"
            const target = action?.target ? ` -> ${action.target}` : ""
            console.log(chalk.magenta(`  [action] ${actionName}${target}`))
            break
        }
        case "final_output":
            console.log(chalk.green(`\n  [final_output] ${event.finalOutput}\n`))
            break
        case "error":
            console.log(chalk.red(`  [error] ${event.message}`))
            break
    }
}

function safeParseJson(value: string): Record<string, any> | null {
    try {
        return JSON.parse(value) as Record<string, any>
    } catch {
        return null
    }
}
