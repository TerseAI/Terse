import { log, spinner } from "@clack/prompts"
import chalk from "chalk"
import { format } from "node:util"

export function createSpinner() {
    return spinner({
        styleFrame: frame => chalk.hex("#04AB62")(frame)
    })
}

export function interceptConsole(onLine: (line: string) => void): () => void {
    const levels = ["log", "info", "warn", "error"] as const
    const original = { log: console.log, info: console.info, warn: console.warn, error: console.error }
    for (const level of levels) {
        console[level] = (...args: unknown[]) => onLine(format(...args))
    }
    return () => {
        for (const level of levels) console[level] = original[level]
    }
}

// Log lines print once and scroll naturally; the spinner lifts out of the way for
// each one, so colored output never collides with clack's repaint.
export function createRunIndicator(title: string) {
    const spin = spinner({ styleFrame: frame => chalk.hex("#04AB62")(frame), withGuide: false })
    let live = false

    return {
        start() {
            live = true
            spin.start(title)
        },
        logLine(line: string) {
            if (live) spin.clear()
            for (const l of line.split("\n")) log.message(l, { spacing: 0 })
            if (live) spin.start(title)
        },
        pause(message: string) {
            live = false
            spin.stop(message)
        },
        succeed(message: string) {
            live = false
            spin.stop(message)
        },
        fail(message: string) {
            live = false
            spin.error(message)
        }
    }
}

export function logNextSteps(steps: string[]): void {
    steps.forEach((step, index) => {
        log.step(`${index + 1}. ${step}`)
    })
}

export function formatSummaryList(items: string[], maxItems = 8): string {
    if (items.length <= maxItems) {
        return items.join(", ")
    }

    const visible = items.slice(0, maxItems)
    const remaining = items.length - maxItems
    return `${visible.join(", ")}, +${remaining} more`
}
