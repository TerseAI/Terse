import chalk from "chalk"

import { readApiKeyOrBail, resolveEventFromRunId } from "./api.js"
import { loadJob } from "./loadJob.js"
import type { LanguageProvider } from "./providers/LanguageProvider.js"
import { resolveProvider } from "./providers/resolveProvider.js"

export async function replay(runId: string, provider: LanguageProvider = resolveProvider()): Promise<void> {
    const apiKey = readApiKeyOrBail()

    if (!runId) {
        console.error(chalk.red("Error: --run-id is required.\n"))
        console.error(chalk.dim("  Usage: terse replay --run-id <run-id>"))
        process.exit(1)
    }

    const runHistoryRecord = await resolveEventFromRunId(runId, apiKey)
    if (!runHistoryRecord) {
        console.error(chalk.red("Error: Could not fetch the trigger event for run ${runId}.\n"))
        process.exit(1)
    }

    const { job } = await loadJob(provider, runHistoryRecord.agentName)

    await provider.executeJob(job, null, runHistoryRecord.event, { verbose: true })
}
