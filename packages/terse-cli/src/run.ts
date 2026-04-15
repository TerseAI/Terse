import chalk from "chalk"
import fs from "fs"
import { ApiRoutes, buildRoute, sdkRunTriggerEventResponseSchema, serializedEventSchema } from "terse-types"
import type { SdkRunTriggerEventResponse, SerializedEvent } from "terse-types"

import { fetchWithAuth, readApiKey } from "./api.js"
import { loadJob } from "./loadJob.js"
import type { LanguageProvider } from "./providers/LanguageProvider.js"
import { resolveProvider } from "./providers/resolveProvider.js"

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

    readApiKey()

    let rawEvent: unknown
    if (eventJson) {
        try {
            rawEvent = JSON.parse(eventJson)
        } catch (error) {
            console.error(chalk.red("Error: --event must be valid JSON."))
            console.error(chalk.dim(error instanceof Error ? error.message : String(error)))
            process.exit(1)
        }
    } else {
        rawEvent = await resolveEventFromRunId()
    }

    if (!rawEvent) {
        console.error(chalk.red("Error: --event <json> or --event-file <path> is required.\n"))
        console.error(chalk.dim('  Usage: terse run --event \'{"integrationType":"...","eventType":"...","formattedContent":"...","debugLog":"...","data":{...}}\''))
        console.error(chalk.dim("         terse run --event-file ./event.json"))
        console.error(chalk.dim("  Tip:   Use `terse test` to interactively pick a sample event.\n"))
        process.exit(1)
    }

    const { job } = await loadJob(provider, jobName, entryFile)

    let parsed: SerializedEvent
    try {
        parsed = serializedEventSchema.parse(rawEvent)
    } catch (error) {
        console.error(chalk.red("Error: --event does not match the canonical Trigger schema."))
        console.error(chalk.dim(error instanceof Error ? error.message : String(error)))
        process.exit(1)
    }

    await provider.executeJob(job, parsed, { entryFile })
}

async function resolveEventFromRunId(): Promise<unknown | undefined> {
    const runId = process.env.TERSE_RUN_ID?.trim()
    if (!runId) {
        return undefined
    }

    const apiKey = process.env.TERSE_API_KEY ?? null
    if (!apiKey) {
        console.error(chalk.red(`Error: TERSE_RUN_ID is set but TERSE_API_KEY is missing, so the trigger event for run ${runId} cannot be fetched.`))
        process.exit(1)
    }

    try {
        const response = await fetchWithAuth<SdkRunTriggerEventResponse>(buildRoute(ApiRoutes.SDK.RUN_TRIGGER_EVENT, { runId }), apiKey)
        return sdkRunTriggerEventResponseSchema.parse(response).event
    } catch (error) {
        console.error(chalk.red(`Error: Could not fetch the trigger event for run ${runId}.`))
        console.error(chalk.dim(error instanceof Error ? error.message : String(error)))
        process.exit(1)
    }
}
