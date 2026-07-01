import chalk from "chalk"
import path from "node:path"

import { readApiKeyOrBail } from "../../../api.js"
import { CliError } from "../../../cliError.js"
import { BACKEND_URL } from "../../../config.js"
import { getDurableRuntime } from "../durableRuntime.js"
import { readRunStatus, resolveWorkflowRunId, rewindFailedRun } from "../rewindRun.js"

import { type JobRuntime, formatErrorDetail } from "./JobRuntime.js"
import { withSession } from "./session.js"

export const durableJobRuntime: JobRuntime = {
    async executeJob(job, runId, event, opts) {
        const isVerbose = opts?.verbose ?? true
        const pauseUiAround = opts?.pauseUiAround ?? (async fn => fn())
        const apiKey = readApiKeyOrBail({ title: "TERSE_API_KEY is not set.", detail: "Please set it in your environment variables." })

        try {
            await withSession(apiKey, isVerbose, pauseUiAround, async sessionId => {
                if (isVerbose) console.log(chalk.cyan(`  Job "${job.name}" started`))
                const rt = await getDurableRuntime(process.cwd())
                await rt.dispatchJob(job.name, { sessionId, runId, apiBaseUrl: BACKEND_URL }, event)
            })
        } catch (error) {
            if (error instanceof CliError) throw error
            throw new CliError("job_execution_failed", `Job "${job.name}" threw an error.`, { detail: formatErrorDetail(error) })
        }
    },

    async resumeRun(runId, opts) {
        const isVerbose = opts?.verbose ?? true
        const pauseUiAround = opts?.pauseUiAround ?? (async fn => fn())
        const apiKey = readApiKeyOrBail({ title: "TERSE_API_KEY is not set.", detail: "Please set it in your environment variables." })

        const dataDir = process.env.WORKFLOW_LOCAL_DATA_DIR ?? path.join(process.cwd(), ".terse", "data")
        const workflowRunId = resolveWorkflowRunId(dataDir, runId)
        const status = readRunStatus(dataDir, workflowRunId)

        try {
            await withSession(apiKey, isVerbose, pauseUiAround, async () => {
                if (status === "failed") {
                    const { rewoundStepId } = rewindFailedRun(dataDir, workflowRunId)
                    if (isVerbose) console.log(chalk.yellow(`  Re-driving failed run ${workflowRunId}${rewoundStepId ? " from the failed step" : ""}; completed steps replay from the journal`))
                } else if (isVerbose) {
                    console.log(chalk.cyan(`  Resuming run ${workflowRunId}`))
                }
                const rt = await getDurableRuntime(process.cwd())
                await rt.resumeRun(workflowRunId)
                if (isVerbose) console.log(chalk.green(`  Run ${workflowRunId} completed`))
            })
        } catch (error) {
            if (error instanceof CliError) throw error
            throw new CliError("run_resume_failed", `Run "${runId}" could not be resumed.`, { detail: formatErrorDetail(error) })
        }
    }
}
