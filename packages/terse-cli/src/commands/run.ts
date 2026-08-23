import chalk from "chalk"
import fs from "fs"
import type { SerializedEvent } from "terse-types"

import { readRunId, readRuntimeKeyOrBail, resolveEventFromRunId } from "../api.js"
import { CliError } from "../cliError.js"
import { getLocalHoistMarker } from "../cliVersion.js"
import { parseEventFixtureJson } from "../eventFixture.js"
import { loadJob } from "../loadJob.js"
import { readProjectConfig, readProjectConfigOrBail } from "../projectConfig.js"
import type { LanguageProvider } from "../providers/LanguageProvider.js"
import { resolveProvider } from "../providers/resolveProvider.js"
import type { SessionHandle } from "../providers/shared/sessionStream.js"
import { startSession } from "../providers/typescript/runtimes/session.js"
import { remoteDispatchNotice, runLocalTestJob } from "../runLocalTestJob.js"
import { parseSerializedEventJson } from "../serializedEvent.js"

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

    const apiKey = readRuntimeKeyOrBail()
    const runId = readRunId()

    // Opened up front so its round trip overlaps loading the job registry. The no-op catch keeps a
    // failed open from tripping node's unhandled-rejection exit before withSession awaits it.
    const session = runId ? startSession(apiKey, verbose ?? true, async fn => fn()) : undefined
    session?.catch(() => {})
    let sessionAdopted = false

    try {
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
            sessionAdopted = true
            await provider.executeJob(job, runId, parsedEvent, { entryFile, verbose, projectId: readProjectConfig()?.projectId, session })
            return
        }

        const projectId = readProjectConfigOrBail().projectId
        const { runId: dispatchedRunId, local } = await runLocalTestJob(provider, job, parsedEvent, { projectId, apiKey, verbose, entryFile })
        if (!local) console.log(chalk.cyan(`  ${remoteDispatchNotice(dispatchedRunId)}`))
    } finally {
        if (session && !sessionAdopted) await closeUnusedSession(session)
    }
}

async function closeUnusedSession(session: Promise<SessionHandle>): Promise<void> {
    try {
        const handle = await session
        handle.close?.()
    } catch {
        // The open failed, so there is nothing to close.
    }
}
