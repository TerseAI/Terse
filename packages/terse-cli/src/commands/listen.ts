import chalk from "chalk"
import { SessionStreamError, openListenStream } from "terse-sdk"

import { ApiError, readApiKeyOrBail } from "../api.js"
import { CliError } from "../cliError.js"
import { BACKEND_URL } from "../config.js"
import { loadJob } from "../loadJob.js"
import { readProjectConfigOrBail } from "../projectConfig.js"
import type { LanguageProvider } from "../providers/LanguageProvider.js"
import { resolveProvider } from "../providers/resolveProvider.js"

export async function listen(jobName?: string, opts?: ListenOpts): Promise<void> {
    const provider = opts?.provider ?? resolveProvider()
    const verbose = opts?.verbose ?? true

    const apiKey = readApiKeyOrBail({
        title: "Error: Not authenticated.",
        detail: "Run `terse login` to authenticate, or set TERSE_API_KEY in your environment."
    })

    const projectConfig = readProjectConfigOrBail()

    const { job: localJob } = await loadJob(provider, jobName, opts?.entryFile)

    let handle
    try {
        handle = await openListenStream(BACKEND_URL, apiKey, {
            jobName: localJob.name,
            projectId: projectConfig.projectId,
            onEvent: async event => {
                if (event.type !== "forwarded_event") return
                const eventLabel = event.event.display?.title || `${event.event.integrationType} / ${event.event.eventType}`
                console.log(`  ${chalk.green("→")} ${chalk.cyan(localJob.name)} ${chalk.dim("←")} ${eventLabel}`)
                try {
                    await provider.executeJob(localJob, null, event.event, { verbose })
                } catch (error) {
                    const detail = error instanceof Error ? error.message : String(error)
                    console.log(chalk.red(`  ✗ ${localJob.name} failed: ${detail}`))
                }
            }
        })
    } catch (error) {
        throw mapListenStreamError(error, localJob.name)
    }

    console.log("")
    console.log(chalk.bold(`  terse listen — ${chalk.cyan(localJob.name)}`))
    console.log(chalk.dim(`  Backend: ${BACKEND_URL}`))
    console.log(chalk.dim(`  Org: ${handle.organizationId}`))
    console.log("")
    console.log(chalk.dim("  Waiting for events… Press Ctrl-C to stop.\n"))

    await new Promise<void>(resolve => {
        const stop = () => {
            handle.close()
            console.log(chalk.dim("\n  Stopped listening.\n"))
            resolve()
        }
        process.once("SIGINT", stop)
        process.once("SIGTERM", stop)
    })
}

function mapListenStreamError(error: unknown, jobName: string): unknown {
    if (error instanceof SessionStreamError) {
        if (error.status === 401 || error.status === 403) {
            return new CliError("not_authenticated", "Not authenticated.", {
                detail: "Your TERSE_API_KEY is missing, expired, or invalid. Run `terse login` to re-authenticate.",
                actionRequired: true
            })
        }
        if (error.status === 404) {
            return new CliError("listen_local_job_not_deployed", `Job "${jobName}" is not deployed in this project.`, {
                detail: "Run `terse deploy` to deploy it, then re-run `terse listen`. Without a deployed agent, no events will be forwarded for this job."
            })
        }
        return new CliError("listen_stream_failed", "Could not open the listen stream.", {
            detail: `${error.message}\n  Backend: ${BACKEND_URL}`
        })
    }
    if (error instanceof ApiError) {
        return new CliError("listen_stream_failed", "Could not open the listen stream.", {
            detail: error.message
        })
    }
    return error
}

// Types

export type ListenOpts = {
    verbose?: boolean
    entryFile?: string
    provider?: LanguageProvider
}
