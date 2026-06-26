import chalk from "chalk"
import type { CreateJobParameters } from "terse-sdk"
import type { SerializedEvent } from "terse-types"

import { finalizeTestRun, startTestRun } from "./api.js"
import type { LanguageProvider } from "./providers/LanguageProvider.js"

/**
 * Run a job as a first-class `terse test` run. Starts the run through the backend's run-trigger endpoint
 * (the EventProcessor path), which mints the is_test run and either returns it for local driving or
 * dispatches it to the project's self-hosted webhook. For a local run we drive execution here and finalize
 * it; for a webhook run the self-hosted server drives and finalizes, so we just report it.
 *
 * `forceLocal` keeps inherently-local commands (listen, replay) local even on self-hosted projects.
 */
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
