import { readApiKeyOrBail, resolveEventFromRunId } from "../api.js"
import { CliError } from "../cliError.js"
import { loadJob } from "../loadJob.js"
import { readProjectConfig } from "../projectConfig.js"
import type { LanguageProvider } from "../providers/LanguageProvider.js"
import { resolveProvider } from "../providers/resolveProvider.js"

export async function replay(runId: string, provider: LanguageProvider = resolveProvider()): Promise<void> {
    const apiKey = readApiKeyOrBail()

    if (!runId) {
        throw new CliError("missing_run_id", "Run id is required.", {
            detail: "Usage: terse replay <run-id>"
        })
    }

    const runHistoryRecord = await resolveEventFromRunId(runId, apiKey)
    if (!runHistoryRecord) {
        throw new CliError("run_trigger_event_missing", `Could not fetch the trigger event for run ${runId}.`)
    }

    const { job } = await loadJob(provider, runHistoryRecord.agentName)

    await provider.executeJob(job, null, runHistoryRecord.event, { verbose: true, projectId: readProjectConfig()?.projectId })
}
