import chalk from "chalk"
import { confirm } from "@inquirer/prompts"
import { BACKEND_URL } from "../../config.js"
import { ApiRoutes } from "terse-types"
import type { SdkApprovalDecisionRequestBody, SdkAgentStreamEvent } from "../../shared/types.js"

type SessionStartedEvent = {
    type: "session_started"
    sessionId: string
}

export type SessionStreamEvent = SdkAgentStreamEvent | SessionStartedEvent

export type SessionHandle = {
    sessionId: string
    close: () => void
}

type SessionStreamOptions = {
    verbose?: boolean
    isPaused?: () => boolean
    onEvent?: (event: SessionStreamEvent) => Promise<void> | void
}

export async function openSessionStream(
    apiKey: string,
    options: SessionStreamOptions = {}
): Promise<SessionHandle> {
    const response = await fetch(`${BACKEND_URL}${ApiRoutes.SDK.SESSION_EVENTS}`, {
        headers: { Authorization: `Bearer ${apiKey}`, Accept: "text/event-stream" },
    })

    if (!response.ok || !response.body) {
        throw new Error(`Failed to open session event stream (HTTP ${response.status})`)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ""

    const sessionId = await readSessionId(reader, decoder, buffer)
    buffer = sessionId.remainingBuffer

    startEventConsumer(reader, decoder, buffer, options)

    return {
        sessionId: sessionId.value,
        close: () => reader.cancel().catch(() => {}),
    }
}

export async function submitApprovalDecision(
    apiKey: string,
    params: SdkApprovalDecisionRequestBody
): Promise<void> {
    const response = await fetch(`${BACKEND_URL}${ApiRoutes.SDK.APPROVAL_DECISION}`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(params),
    })

    if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as Record<string, unknown>
        throw new Error(`Approval decision failed: ${String(body.error ?? response.statusText)}`)
    }
}

export function logSessionEvent(
    event: SessionStreamEvent,
    options: { isPaused?: () => boolean; verbose?: boolean } = {}
): void {
    if (!options.verbose) return
    if (options.isPaused?.()) return
    if (event.type === "session_started" || event.type === "tool_approval_requested" || event.type === "run_started") {
        return
    }

    switch (event.type) {
        case "tool_call_started":
            console.log(chalk.blue(`  [tool:start] ${event.toolCallStarted}`))
            break
        case "tool_call_completed": {
            const parsed = safeParseJson(event.toolCallCompleted)
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

export async function promptForToolApproval(toolName: string, rawArguments: string): Promise<boolean> {
    console.log("")
    console.log(chalk.yellow.bold(`  Approval required: ${toolName}`))
    if (rawArguments) {
        try {
            const parsed = JSON.parse(rawArguments)
            const formatted = JSON.stringify(parsed, null, 2)
                .split("\n")
                .map(line => `    ${chalk.dim(line)}`)
                .join("\n")
            console.log(formatted)
        } catch {
            console.log(`    ${chalk.dim(rawArguments)}`)
        }
    }
    console.log("")

    const approved = await confirm({
        message: `Approve ${toolName}?`,
        default: true,
    })

    console.log(
        approved
            ? chalk.green("  Approved. Resuming...\n")
            : chalk.red("  Rejected.\n")
    )

    return approved
}

async function readSessionId(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    decoder: TextDecoder,
    buffer: string
): Promise<{ value: string; remainingBuffer: string }> {
    while (true) {
        const { done, value } = await reader.read()
        if (done) {
            throw new Error("Session stream ended before sending sessionId")
        }

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""

        for (const line of lines) {
            if (!line.startsWith("data: ")) continue
            const event = safeParseJson(line.slice(6))
            if (event?.type === "session_started" && typeof event.sessionId === "string") {
                return { value: event.sessionId, remainingBuffer: buffer }
            }
        }
    }
}

function startEventConsumer(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    decoder: TextDecoder,
    initialBuffer: string,
    options: SessionStreamOptions
): void {
    let buffer = initialBuffer

    void (async () => {
        try {
            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split("\n")
                buffer = lines.pop() ?? ""

                for (const line of lines) {
                    if (!line.startsWith("data: ")) continue
                    const event = safeParseJson(line.slice(6)) as SessionStreamEvent | null
                    if (!event) continue
                    if (options.onEvent) {
                        try {
                            await options.onEvent(event)
                        } catch (error) {
                            console.error(chalk.red(`  Session event handler failed: ${(error as Error).message}`))
                        }
                    }
                    logSessionEvent(event, options)
                }
            }
        } catch {
            // Stream cancelled by close() — expected
        }
    })()
}

function safeParseJson(value: string): Record<string, unknown> | null {
    try {
        return JSON.parse(value) as Record<string, unknown>
    } catch {
        return null
    }
}
