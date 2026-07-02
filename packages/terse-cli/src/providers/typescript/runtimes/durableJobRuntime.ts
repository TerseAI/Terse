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
                await deliverHookPayload(rt, isVerbose)
                await rt.resumeRun(workflowRunId)
                if (isVerbose) console.log(chalk.green(`  Run ${workflowRunId} completed`))
            })
        } catch (error) {
            if (error instanceof CliError) throw error
            throw new CliError("run_resume_failed", `Run "${runId}" could not be resumed.`, { detail: formatErrorDetail(error) })
        }
    }
}

// A resume triggered by a human response (waitForInput) carries the hook payload in the
// environment. Delivery failure is not fatal: resuming anyway replays the run, which then
// re-parks on whatever it is actually waiting for and re-snapshots itself.
async function deliverHookPayload(rt: Awaited<ReturnType<typeof getDurableRuntime>>, isVerbose: boolean): Promise<void> {
    const token = process.env.TERSE_RESUME_HOOK_TOKEN
    if (!token) return

    const payloadRaw = process.env.TERSE_RESUME_HOOK_PAYLOAD
    if (!payloadRaw) {
        console.log(chalk.yellow(`  Hook resume requested for ${token} but no payload was provided; resuming without it`))
        return
    }

    try {
        await rt.resumeHook(token, JSON.parse(payloadRaw))
        if (isVerbose) console.log(chalk.cyan(`  Delivered input response to hook ${token}`))
    } catch (error) {
        console.log(chalk.yellow(`  Could not deliver input response to hook ${token}: ${formatErrorDetail(error)}`))
    }
}
