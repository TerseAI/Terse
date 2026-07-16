import { CronExpressionParser } from "cron-parser"
import cronstrue from "cronstrue"

export function describeCron(cron: string): string | null {
    try {
        return cronstrue.toString(cron)
    } catch {
        return null
    }
}

export function getNextRun(cron: string, timezone: string): Date | null {
    // cron-parser treats an empty expression as "* * * * *"
    if (!cron.trim()) return null
    try {
        return CronExpressionParser.parse(cron, { tz: timezone }).next().toDate()
    } catch {
        return null
    }
}

export function formatNextRun(date: Date): string {
    return new Intl.DateTimeFormat("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short"
    }).format(date)
}
