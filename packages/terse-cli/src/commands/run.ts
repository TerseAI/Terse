import chalk from "chalk"
import fs from "fs"
import { serializedEventSchema } from "terse-types"
import type { SerializedEvent } from "terse-types"

import { readApiKeyOrBail, readRunId, resolveEventFromRunId } from "../api.js"
import { loadJob } from "../loadJob.js"
import type { LanguageProvider } from "../providers/LanguageProvider.js"
import { resolveProvider } from "../providers/resolveProvider.js"

export async function run(jobName?: string, eventJson?: string, eventFile?: string, provider: LanguageProvider = resolveProvider(), entryFile?: string): Promise<void> {
    if (eventFile && !eventJson) {
        try {
            eventJson = fs.readFileSync(eventFile, "utf-8")
        } catch (err) {
            console.error(chalk.red(`Error: Could not read event file: ${eventFile}`))
            console.error(chalk.dim(err instanceof Error ? err.message : String(err)))
            process.exit(1)
        }
    }

    const apiKey = readApiKeyOrBail({
        title: "Error: Not authenticated.",
        detail: "Run `terse login` to authenticate, or set TERSE_API_KEY in your environment."
    })
    const runId = readRunId()

    const { job } = await loadJob(provider, jobName, entryFile)

    let parsedEvent: SerializedEvent
    if (eventJson) {
        let rawEvent: unknown
        try {
            rawEvent = JSON.parse(eventJson)
        } catch (error) {
            console.error(chalk.red("Error: --event must be valid JSON."))
            console.error(chalk.dim(error instanceof Error ? error.message : String(error)))
            process.exit(1)
        }

        if (!rawEvent) {
            console.error(chalk.red("Error: --event <json> or --event-file <path> is required.\n"))
            console.error(chalk.dim('  Usage: terse run --event \'{"integrationType":"...","eventType":"...","formattedContent":"...","debugLog":"...","data":{...}}\''))
            console.error(chalk.dim("         terse run --event-file ./event.json"))
            console.error(chalk.dim("  Tip:   Use `terse test` to interactively pick a sample event.\n"))
            process.exit(1)
        }

        try {
            parsedEvent = serializedEventSchema.parse(rawEvent)
        } catch (error) {
            console.error(chalk.red("Error: --event does not match the canonical Trigger schema."))
            console.error(chalk.dim(error instanceof Error ? error.message : String(error)))
            process.exit(1)
        }
    } else {
        const resolvedEvent = await resolveEventFromRunId(runId, apiKey)
        if (!resolvedEvent) {
            console.error(chalk.red("Error: Could not resolve event from run ID."))
            process.exit(1)
        }
        parsedEvent = resolvedEvent.event
    }

    await provider.executeJob(job, runId, parsedEvent, { entryFile })
}
