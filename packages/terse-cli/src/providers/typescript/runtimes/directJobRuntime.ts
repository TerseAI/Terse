import chalk from "chalk"
import { __buildJobStateAccessor, createSDKTrigger } from "terse-sdk"
import { runWithJobContext } from "terse-sdk/dist/runIdentity/jobContextStore.js"

import { readApiKeyOrBail } from "../../../api.js"
import { CliError } from "../../../cliError.js"
import { BACKEND_URL } from "../../../config.js"

import { type JobRuntime, formatErrorDetail } from "./JobRuntime.js"
import { withSession } from "./session.js"

export const directJobRuntime: JobRuntime = {
    async executeJob(job, runId, event, opts) {
        const isVerbose = opts?.verbose ?? true
        const pauseUiAround = opts?.pauseUiAround ?? (async fn => fn())
        const apiKey = readApiKeyOrBail({ title: "TERSE_API_KEY is not set.", detail: "Please set it in your environment variables." })
        const inputEvent = createSDKTrigger(event)

        try {
            await withSession(
                apiKey,
                isVerbose,
                pauseUiAround,
                async sessionId => {
                    await runWithJobContext({ sessionId, runId, apiBaseUrl: BACKEND_URL, projectId: opts?.projectId, jobName: job.name }, async () => {
                        const state = __buildJobStateAccessor(job.states ?? [])
                        if (job.filter && !(await job.filter(inputEvent, state))) {
                            if (isVerbose) console.log(chalk.dim(`\n  Job "${job.name}" skipped (filter returned false).\n`))
                            return
                        }
                        if (isVerbose) console.log(chalk.cyan(`  Job "${job.name}" started`))
                        await job.onTrigger(inputEvent, state)
                    })
                },
                opts?.onSessionEvent
            )
        } catch (error) {
            if (error instanceof CliError) throw error
            if (error instanceof Error && error.name === "DurableOnlyError") {
                throw new CliError("durable_only", error.message, { actionRequired: true })
            }
            throw new CliError("job_execution_failed", `Job "${job.name}" threw an error.`, { detail: formatErrorDetail(error) })
        }
    },

    async resumeRun() {
        throw new CliError("resume_not_durable", "Only durable jobs can be resumed.", {
            detail: "This run belongs to a non-durable job — non-durable jobs run to completion and never suspend."
        })
    },

    async resumeRunWithInput() {
        throw new CliError("resume_not_durable", "Only durable jobs can be resumed.", {
            detail: "This run belongs to a non-durable job — non-durable jobs run to completion and never suspend."
        })
    }
}
