import fs from "fs"
import { serializedEventSchema } from "terse-types"
import type { SerializedEvent } from "terse-types"

import { readApiKeyOrBail, readRunId, resolveEventFromRunId } from "../api.js"
import { CliError } from "../cliError.js"
import { getLocalHoistMarker } from "../cliVersion.js"
import { loadJob } from "../loadJob.js"
import type { LanguageProvider } from "../providers/LanguageProvider.js"
import { resolveProvider } from "../providers/resolveProvider.js"

export async function run(jobName?: string, eventJson?: string, eventFile?: string, provider: LanguageProvider = resolveProvider(), entryFile?: string, verbose?: boolean): Promise<void> {
    const hoistMarker = getLocalHoistMarker()
    if (hoistMarker) {
        console.log(`[terse] running locally-hoisted packages: ${hoistMarker}`)
    }

    if (eventFile && !eventJson) {
        try {
            eventJson = fs.readFileSync(eventFile, "utf-8")
        } catch (err) {
            throw new CliError("event_file_unreadable", `Could not read event file: ${eventFile}`, {
                detail: err instanceof Error ? err.message : String(err)
            })
        }
    }

    const apiKey = readApiKeyOrBail({
        title: "Error: Not authenticated.",
        detail: "Run `terse auth login` to authenticate, or set TERSE_API_KEY in your environment."
    })
    const runId = readRunId()

    const { job } = await loadJob(provider, jobName, entryFile)

    let parsedEvent: SerializedEvent
    if (eventJson) {
        let rawEvent: unknown
        try {
            rawEvent = JSON.parse(eventJson)
        } catch (error) {
            throw new CliError("invalid_event_json", "--event must be valid JSON.", {
                detail: error instanceof Error ? error.message : String(error)
            })
        }

        if (!rawEvent) {
            throw new CliError("missing_event", "Provide --event <json> or --event-file <path>.", {
                detail: 'Usage: terse run --event \'{"integrationType":"...","eventType":"...","formattedContent":"...","debugLog":"...","data":{...}}\'\n       terse run --event-file ./event.json\nTip:   Use `terse test` to interactively pick a sample event.'
            })
        }

        try {
            parsedEvent = serializedEventSchema.parse(rawEvent)
        } catch (error) {
            throw new CliError("invalid_event_shape", "--event does not match the canonical Trigger schema.", {
                detail: error instanceof Error ? error.message : String(error)
            })
        }
    } else {
        const resolvedEvent = await resolveEventFromRunId(runId, apiKey)
        if (!resolvedEvent) {
            throw new CliError("run_trigger_event_missing", "Could not resolve event from run ID.")
        }
        parsedEvent = resolvedEvent.event
    }

    await provider.executeJob(job, runId, parsedEvent, { entryFile, verbose })
}
