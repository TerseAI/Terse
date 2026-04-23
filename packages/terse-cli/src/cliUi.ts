import { log, spinner } from "@clack/prompts"
import chalk from "chalk"

export function createSpinner() {
    return spinner({
        styleFrame: frame => chalk.hex("#04AB62")(frame)
    })
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
