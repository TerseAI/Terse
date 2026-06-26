import chalk from "chalk"
import type { CreateJobParameters } from "terse-sdk"
import type { SerializedEvent } from "terse-types"

import { finalizeTestRun, startTestRun } from "./api.js"
import type { LanguageProvider } from "./providers/LanguageProvider.js"

export async function runLocalTestJob(
    provider: LanguageProvider,
    job: CreateJobParameters,
    event: SerializedEvent,
    opts: {
        projectId: string
        apiKey: string
        forceLocal?: boolean
        verbose?: boolean
        entryFile?: string
        pauseUiAround?: <T>(fn: () => Promise<T>) => Promise<T>
    }
): Promise<void> {
    const { runId, local } = await startTestRun({ projectId: opts.projectId, jobName: job.name, event, forceLocal: opts.forceLocal }, opts.apiKey)

    if (!local) {
        console.log(chalk.cyan(`  Dispatched test event to your self-hosted data plane (run ${runId}). Watch it in the dashboard.`))
        return
    }

    let failure: Error | null = null
    try {
        await provider.executeJob(job, runId, event, {
            verbose: opts.verbose,
            entryFile: opts.entryFile,
            projectId: opts.projectId,
            pauseUiAround: opts.pauseUiAround
        })
    } catch (error) {
        failure = error instanceof Error ? error : new Error(String(error))
        throw error
    } finally {
        await finalizeTestRun(runId, failure ? "failed" : "success", opts.apiKey, failure?.message)
    }
}
