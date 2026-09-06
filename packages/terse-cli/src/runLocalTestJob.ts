import type { CreateJobParameters, SessionStreamEvent } from "terse-sdk"
import type { SerializedEvent } from "terse-types"

import { finalizeTestRun, startTestRun } from "./api.js"
import { withDurableObjectEnvironment } from "./durableObjectEnvironment.js"
import type { LanguageProvider } from "./providers/LanguageProvider.js"

export async function runLocalTestJob(
    provider: LanguageProvider,
    job: CreateJobParameters,
    event: SerializedEvent,
    opts: {
        projectId: string
        apiKey: string
        forceLocal?: boolean
        isTest?: boolean
        replayOfRunId?: string
        freshState?: boolean
        verbose?: boolean
        entryFile?: string
        pauseUiAround?: <T>(fn: () => Promise<T>) => Promise<T>
        onSessionEvent?: (event: SessionStreamEvent) => void
    }
): Promise<{ runId: string; local: boolean }> {
    const { runId, local, durableObjects } = await startTestRun(
        {
            projectId: opts.projectId,
            jobName: job.name,
            event,
            forceLocal: opts.forceLocal,
            isTest: opts.isTest,
            replayOfRunId: opts.replayOfRunId,
            freshState: opts.freshState
        },
        opts.apiKey
    )

    if (!local) return { runId, local }

    let failure: Error | null = null
    try {
        await withDurableObjectEnvironment(durableObjects, () =>
            provider.executeJob(job, runId, event, {
                verbose: opts.verbose,
                entryFile: opts.entryFile,
                projectId: opts.projectId,
                onSessionEvent: opts.onSessionEvent,
                pauseUiAround: opts.pauseUiAround
            })
        )
    } catch (error) {
        failure = error instanceof Error ? error : new Error(String(error))
        throw error
    } finally {
        await finalizeTestRun(runId, failure ? "failed" : "success", opts.apiKey, failure?.message)
    }
    return { runId, local }
}

export function remoteDispatchNotice(runId: string): string {
    return `Dispatched test event to your self-hosted data plane (run ${runId}). Watch it in the dashboard.`
}
