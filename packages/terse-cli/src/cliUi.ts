import { log, spinner, type SpinnerResult } from "@clack/prompts"
import chalk from "chalk"
import { format } from "node:util"

export function createSpinner(): SpinnerResult {
    if (isInteractiveOutput()) {
        return spinner({
            styleFrame: frame => chalk.hex("#04AB62")(frame)
        })
    }
    return new StaticSpinner()
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
    const interactive = isInteractiveOutput()
    const spin = interactive
        ? spinner({ styleFrame: frame => chalk.hex("#04AB62")(frame), withGuide: false })
        : new StaticSpinner()
    let live = false

    return {
        start() {
            live = true
            spin.start(title)
        },
        logLine(line: string) {
            if (live && interactive) spin.clear()
            for (const l of line.split("\n")) log.message(l, { spacing: 0 })
            if (live && interactive) spin.start(title)
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

function isInteractiveOutput(): boolean {
    return Boolean(process.stdout.isTTY) && process.env.CI !== "true" && !process.env.TERSE_NO_SPINNER
}

// Non-TTY drop-in for clack's spinner. A spinner is a human affordance; a captured
// stream just gets its animation frames as literal noise. So progress goes dark and
// only failures, the one thing an agent acts on, print a line.
class StaticSpinner implements SpinnerResult {
    private cancelled = false

    start(): void {}

    message(): void {}

    stop(): void {}

    error(message = ""): void {
        if (message) log.error(message)
    }

    cancel(message = ""): void {
        this.cancelled = true
        if (message) log.error(message)
    }

    clear(): void {}

    get isCancelled(): boolean {
        return this.cancelled
    }
}
