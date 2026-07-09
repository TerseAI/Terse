import chalk from "chalk"
import { isAgentApprovalHandlingClaimed, setLocalPromptUiPause, setLocalToolCallObserver } from "terse-sdk"
import type { SessionStreamEvent } from "terse-sdk"

import { isCliRunCommandEnabled } from "../../../env.js"
import { createToolCallEchoDedup, openSessionStream, printLocalToolCallEvent, promptForToolApproval, submitApprovalDecision } from "../../shared/sessionStream.js"

let sessionPaused = false

// Holds a session stream open (for tool-approval routing) for the duration of `action`.
export async function withSession<T>(apiKey: string, isVerbose: boolean, pauseUiAround: <U>(fn: () => Promise<U>) => Promise<U>, action: (sessionId: string) => Promise<T>): Promise<T> {
    let latestRunId: string | null = null

    const handleSessionEvent = async (event: SessionStreamEvent): Promise<void> => {
        if (event.type === "run_started") {
            latestRunId = event.runId
            return
        }
        if (event.type !== "tool_approval_requested") return
        if (isCliRunCommandEnabled()) return
        if (isAgentApprovalHandlingClaimed()) return

        const runId = latestRunId
        if (!runId) {
            console.error(chalk.red("  Received approval request before run_started — cannot route decision."))
            return
        }

        const { toolName, arguments: rawArguments, stepId } = event.toolApprovalRequested

        if (!process.stdout.isTTY) {
            console.error(chalk.red(`  Approval required for "${toolName}" but no TTY is attached — auto-rejecting.`))
            console.error(chalk.dim("  In non-interactive contexts, set TerseAgent.onApprovalRequired in your job code."))
            try {
                await submitApprovalDecision(apiKey, { runId, stepId, approved: false })
            } catch (error) {
                console.error(chalk.red(`  Failed to submit auto-reject: ${(error as Error).message}`))
            }
            return
        }

        sessionPaused = true
        try {
            await pauseUiAround(async () => {
                const approved = await promptForToolApproval(toolName, rawArguments)
                await submitApprovalDecision(apiKey, { runId, stepId, approved })
            })
        } catch (error) {
            console.error(chalk.red(`  Failed to submit approval decision: ${(error as Error).message}`))
        } finally {
            sessionPaused = false
        }
    }

    const toolEchoDedup = createToolCallEchoDedup()
    const session = await openSessionStream(apiKey, { verbose: isVerbose, isPaused: () => sessionPaused, onEvent: handleSessionEvent, toolEchoDedup })

    setLocalPromptUiPause(pauseUiAround)
    setLocalToolCallObserver(event => {
        toolEchoDedup.expect(event.phase, event.toolName)
        if (!isVerbose || sessionPaused) return
        printLocalToolCallEvent(event)
    })
    try {
        return await action(session.sessionId)
    } finally {
        setLocalPromptUiPause(undefined)
        setLocalToolCallObserver(undefined)
        session.close?.()
    }
}
