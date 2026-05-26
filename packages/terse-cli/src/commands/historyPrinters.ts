import chalk from "chalk"
import { RunHistoryStatus } from "terse-types"
import type { RunHistoryRecord, RunHistoryStatus as RunHistoryStatusType, SerializedEvent } from "terse-types"

import type { RunChatHistory } from "../api.js"

export type RunWithEvents = RunHistoryRecord & { chat?: RunChatHistory; triggerEvent?: SerializedEvent }

export function printRuns(jobName: string, agentId: string, items: RunWithEvents[], total: number): void {
    console.log(chalk.cyan(`\n  History for job: ${jobName}`))
    console.log(chalk.dim(`  Job: ${agentId} — ${items.length} of ${total} run${total === 1 ? "" : "s"}\n`))

    if (items.length === 0) {
        console.log(chalk.dim("  No runs match the requested filters.\n"))
        return
    }

    for (const run of items) {
        const ts = new Date(run.timestamp).toISOString()
        const triggerSource = run.trigger.title ?? run.trigger.source
        console.log(`  ${formatStatus(run.status)} ${chalk.dim(ts)} ${chalk.bold(run.id)}`)
        console.log(`    trigger:  ${run.trigger.integration} — ${triggerSource}`)
        if (run.trigger.subheader) console.log(chalk.dim(`              ${run.trigger.subheader}`))
        console.log(`    decision: ${run.decision.action}${run.decision.reasoning ? ` — ${truncate(run.decision.reasoning, 200)}` : ""}`)
        const actions = run.actions ?? []
        if (actions.length > 0) {
            console.log(`    actions:  ${actions.length}`)
            for (const action of actions.slice(0, 5)) {
                console.log(chalk.dim(`      - [${action.type}] ${action.integration} ${action.action} → ${truncate(action.target, 80)}`))
            }
            if (actions.length > 5) {
                console.log(chalk.dim(`      … and ${actions.length - 5} more`))
            }
        }
        if (run.chat) {
            console.log(chalk.dim(`    events:   ${run.chat.events.length} model event${run.chat.events.length === 1 ? "" : "s"}`))
        }
        const triggerJson = formatTriggerEventForRun(run)
        if (triggerJson) {
            console.log(`    input:`)
            console.log(indent(triggerJson, "      "))
        }
        console.log("")
    }
}

function formatTriggerEventForRun(run: RunWithEvents): string | null {
    if (run.triggerEvent) {
        return JSON.stringify(run.triggerEvent, null, 2)
    }
    if (run.chat?.triggerEvent) {
        return run.chat.triggerEvent
    }
    return null
}

export function printRunChat(runId: string, chat: RunChatHistory): void {
    console.log(chalk.cyan(`\n  Run: ${runId}`))
    console.log(chalk.dim(`  ${chat.startTimestamp} → ${chat.endTimestamp}  status=${chat.status}\n`))

    if (chat.triggerEvent) {
        console.log(chalk.bold(`  Trigger event (${chat.triggerEventType ?? "unknown"})${chat.isTriggerEventTruncated ? " [truncated]" : ""}:`))
        console.log(indent(chat.triggerEvent, "  "))
        console.log("")
    }

    console.log(chalk.bold(`  ${chat.events.length} model event${chat.events.length === 1 ? "" : "s"}:`))
    for (const event of chat.events) {
        console.log(chalk.dim(`  - [${event.type}] ${describeEvent(event)}`))
    }
    console.log("")
}

function describeEvent(event: RunChatHistory["events"][number]): string {
    const anyEvent = event as Record<string, unknown>
    if (typeof anyEvent.text === "string") return truncate(anyEvent.text, 160)
    if (typeof anyEvent.toolName === "string") return `${anyEvent.toolName}`
    if (typeof anyEvent.message === "string") return truncate(anyEvent.message, 160)
    return ""
}

function formatStatus(status: RunHistoryStatusType): string {
    switch (status) {
        case RunHistoryStatus.SUCCESS:
            return chalk.green("✓ success")
        case RunHistoryStatus.FAILED:
            return chalk.red("✗ failed")
        case RunHistoryStatus.CANCELLED:
            return chalk.yellow("⊘ cancelled")
        case RunHistoryStatus.SKIPPED:
            return chalk.dim("· skipped")
        case RunHistoryStatus.IN_PROGRESS:
            return chalk.blue("⟳ in_progress")
        case RunHistoryStatus.AWAITING_APPROVAL:
            return chalk.magenta("? awaiting_approval")
        default:
            return status
    }
}

function truncate(value: string, max: number): string {
    if (value.length <= max) return value
    return value.slice(0, max - 1) + "…"
}

function indent(value: string, prefix: string): string {
    return value
        .split("\n")
        .map(line => `${prefix}${line}`)
        .join("\n")
}
