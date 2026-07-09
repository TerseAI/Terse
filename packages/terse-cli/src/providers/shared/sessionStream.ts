import { confirm } from "@inquirer/prompts"
import chalk from "chalk"
import { type LocalToolCallEvent, SessionStreamError, type SessionStreamEvent, type SessionStreamHandle, openSessionStream as connectTerseSessionStream } from "terse-sdk"
import { ApiRoutes } from "terse-types"
import type { SdkApprovalDecisionRequestBody } from "terse-types"
import { z } from "zod"

import { CliError, ErrorCode } from "../../cliError.js"
import { BACKEND_URL } from "../../config.js"

export type SessionHandle = SessionStreamHandle

type SessionStreamOptions = {
    verbose?: boolean
    isPaused?: () => boolean
    onEvent?: (event: SessionStreamEvent) => Promise<void> | void
    toolEchoDedup?: ToolCallEchoDedup
}

export async function openSessionStream(apiKey: string, options: SessionStreamOptions = {}): Promise<SessionHandle> {
    try {
        return await connectTerseSessionStream(BACKEND_URL, apiKey, {
            onEvent: async (event: SessionStreamEvent) => {
                if (options.onEvent) {
                    try {
                        await options.onEvent(event)
                    } catch (error) {
                        console.error(chalk.red(`  Session event handler failed: ${(error as Error).message}`))
                    }
                }
                logSessionEvent(event, options)
            }
        })
    } catch (error) {
        throw mapSessionStreamError(error)
    }
}

export async function submitApprovalDecision(apiKey: string, params: SdkApprovalDecisionRequestBody): Promise<void> {
    const response = await fetch(`${BACKEND_URL}${ApiRoutes.SDK.APPROVAL_DECISION}`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(params)
    })

    if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as Record<string, unknown>
        throw new Error(`Approval decision failed: ${String(body.error ?? response.statusText)}`)
    }
}

function logSessionEvent(event: SessionStreamEvent, options: SessionStreamOptions = {}): void {
    if (!options.verbose) return
    if (options.isPaused?.()) return
    if (event.type === "session_started" || event.type === "tool_approval_requested" || event.type === "run_started") {
        return
    }

    switch (event.type) {
        case "tool_call_started":
            if (options.toolEchoDedup?.consume("start", event.toolCallStarted)) break
            console.log(chalk.blue(`  [tool:start] ${event.toolCallStarted}`))
            break
        case "tool_call_completed": {
            const parsed = safeParseJson(event.toolCallCompleted)
            const toolName = parsed?.tool || "unknown_tool"
            if (options.toolEchoDedup?.consume("end", toolName)) break
            const status = parsed?.status || "unknown"
            const symbol = status === "completed" ? chalk.green("ok") : chalk.red("failed")
            const detail = parsed?.error ? chalk.dim(` ${singleLine(parsed.error, 200)}`) : ""
            console.log(`  [tool:end] ${toolName} (${symbol})${detail}`)
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
        default: true
    })

    console.log(approved ? chalk.green("  Approved. Resuming...\n") : chalk.red("  Rejected.\n"))

    return approved
}

export function printLocalToolCallEvent(event: LocalToolCallEvent): void {
    switch (event.phase) {
        case "start":
            console.log(chalk.blue(`  [tool:start] ${event.toolName}`))
            break
        case "end": {
            const symbol = event.status === "completed" ? chalk.green("ok") : chalk.red("failed")
            const detail = summarizeToolCallEnd(event)
            console.log(`  [tool:end] ${event.toolName} (${symbol})${detail ? chalk.dim(` ${detail}`) : ""}`)
            break
        }
        default:
            throw event satisfies never
    }
}

export function createToolCallEchoDedup(): ToolCallEchoDedup {
    const pending = new Map<string, number>()
    return {
        expect(phase, toolName) {
            const key = `${phase}:${toolName}`
            pending.set(key, (pending.get(key) ?? 0) + 1)
        },
        consume(phase, toolName) {
            const key = `${phase}:${toolName}`
            const count = pending.get(key) ?? 0
            if (count === 0) return false
            if (count === 1) pending.delete(key)
            else pending.set(key, count - 1)
            return true
        }
    }
}

// Helper functions
function summarizeToolCallEnd(event: Extract<LocalToolCallEvent, { phase: "end" }>): string {
    if (event.status === "failed") return singleLine(event.errorMessage, 200)

    const parsed = toolResultActionsSchema.safeParse(event.result)
    if (parsed.success && parsed.data.actions.length > 0) {
        return parsed.data.actions.map(action => `${action.action} → ${action.target}${action.url ? `, ${action.url}` : ""}`).join("; ")
    }
    if (event.result === undefined || event.result === null) return ""
    try {
        return singleLine(JSON.stringify(event.result), 200)
    } catch {
        return ""
    }
}

const toolResultActionsSchema = z.object({
    actions: z.array(
        z.object({
            action: z.string(),
            target: z.string(),
            url: z.string().optional()
        })
    )
})

function singleLine(value: string, maxLength: number): string {
    const collapsed = value.replace(/\s*\n+\s*/g, " ").trim()
    return collapsed.length <= maxLength ? collapsed : `${collapsed.slice(0, maxLength - 1)}…`
}

function safeParseJson(value: string): { tool?: string; status?: string; error?: string } | null {
    try {
        return JSON.parse(value) as { tool?: string; status?: string; error?: string }
    } catch {
        return null
    }
}

function mapSessionStreamError(error: unknown): unknown {
    if (error instanceof SessionStreamError) {
        if (error.status === 401 || error.status === 403) {
            return new CliError("not_authenticated", "Not authenticated.", {
                detail: "Your TERSE_API_KEY is missing, expired, or invalid. Run `terse auth login` to re-authenticate, or set a valid TERSE_API_KEY in your environment.",
                actionRequired: true,
                exitCode: ErrorCode.BAD_ARGUMENTS
            })
        }
        return new CliError("session_stream_failed", "Could not start a Terse session.", {
            detail: `${error.message}\n  Backend: ${BACKEND_URL}`
        })
    }
    return error
}

export type ToolCallEchoDedup = {
    expect(phase: "start" | "end", toolName: string): void
    consume(phase: "start" | "end", toolName: string): boolean
}
