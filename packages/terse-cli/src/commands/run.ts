import chalk from "chalk"
import fs from "fs"
import type { SerializedEvent } from "terse-types"

import { readApiKeyOrBail, readRunId, resolveEventFromRunId } from "../api.js"
import { CliError } from "../cliError.js"
import { getLocalHoistMarker } from "../cliVersion.js"
import { parseEventFixtureJson } from "../eventFixture.js"
import { loadJob } from "../loadJob.js"
import { readProjectConfig, readProjectConfigOrBail } from "../projectConfig.js"
import type { LanguageProvider } from "../providers/LanguageProvider.js"
import { resolveProvider } from "../providers/resolveProvider.js"
import { remoteDispatchNotice, runLocalTestJob } from "../runLocalTestJob.js"

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
        parsedEvent = parseEventFixtureJson(eventJson, "--event / --event-file")
    } else if (runId) {
        const resolvedEvent = await resolveEventFromRunId(runId, apiKey)
        if (!resolvedEvent) {
            throw new CliError("run_trigger_event_missing", "Could not resolve event from run ID.")
        }
        parsedEvent = resolvedEvent.event
    } else {
        throw new CliError("missing_event", "Provide --event <json> or --event-file <path>.", {
            detail: "Usage: terse run --event-file ./event.json\nTip:   Use `terse test` to interactively pick a sample event."
        })
    }

    if (runId) {
        await provider.executeJob(job, runId, parsedEvent, { entryFile, verbose, projectId: readProjectConfig()?.projectId })
        return
    }

    const projectId = readProjectConfigOrBail().projectId
    const { runId: dispatchedRunId, local } = await runLocalTestJob(provider, job, parsedEvent, { projectId, apiKey, verbose, entryFile })
    if (!local) console.log(chalk.cyan(`  ${remoteDispatchNotice(dispatchedRunId)}`))
}
