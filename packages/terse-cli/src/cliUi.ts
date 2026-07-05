import { log, spinner } from "@clack/prompts"
import chalk from "chalk"
import { format, stripVTControlCharacters } from "node:util"

export function createSpinner() {
    return spinner({
        styleFrame: frame => chalk.hex("#04AB62")(frame)
    })
}

// ANSI codes are stripped so clack's line-wrap math stays exact.
export function interceptConsole(onLine: (line: string) => void): () => void {
    const levels = ["log", "info", "warn", "error"] as const
    const original = { log: console.log, info: console.info, warn: console.warn, error: console.error }
    for (const level of levels) {
        console[level] = (...args: unknown[]) => onLine(stripVTControlCharacters(format(...args)))
    }
    return () => {
        for (const level of levels) console[level] = original[level]
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
