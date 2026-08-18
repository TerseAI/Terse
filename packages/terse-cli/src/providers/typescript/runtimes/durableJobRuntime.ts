import chalk from "chalk"
import path from "node:path"

import { readRuntimeKeyOrBail } from "../../../api.js"
import { CliError } from "../../../cliError.js"
import { BACKEND_URL } from "../../../config.js"
import { isCliRunCommandEnabled } from "../../../env.js"
import { closeDurableRuntime, getDurableRuntime } from "../durableRuntime.js"
import { readRunStatus, resolveWorkflowRunId, rewindFailedRun } from "../rewindRun.js"

import { type JobRuntime, type ResumeHookInput, type ResumeRunOptions, formatErrorDetail } from "./JobRuntime.js"
import { withSession } from "./session.js"

export const durableJobRuntime: JobRuntime = {
    async executeJob(job, runId, event, opts) {
        const isVerbose = opts?.verbose ?? true
        const pauseUiAround = opts?.pauseUiAround ?? (async fn => fn())
        const apiKey = readRuntimeKeyOrBail()

        try {
            await withSession(
                apiKey,
                isVerbose,
                pauseUiAround,
                async sessionId => {
                    if (isVerbose) console.log(chalk.cyan(`  Job "${job.name}" started`))
                    const rt = await getDurableRuntime(process.cwd())
                    await rt.start()
                    const dispatched = await rt.dispatchJob(job.name, { sessionId, runId, apiBaseUrl: BACKEND_URL }, event)

                    // We can't await in the Modal Sandbox. This polls, and a blocked run will never exit.
                    if (!isCliRunCommandEnabled()) await dispatched.awaitResult()
                },
                opts?.onSessionEvent
            )
        } catch (error) {
            if (error instanceof CliError) throw error
            throw new CliError("job_execution_failed", `Job "${job.name}" threw an error.`, { detail: formatErrorDetail(error) })
        } finally {
            if (!isCliRunCommandEnabled()) await closeDurableRuntime()
        }
    },

    async resumeRun(runId, opts) {
        return driveResume(runId, opts)
    },

    async resumeRunWithInput(runId, input, opts) {
        return driveResume(runId, opts, input)
    }
}

async function driveResume(runId: string, opts: ResumeRunOptions | undefined, input?: ResumeHookInput): Promise<void> {
    const isVerbose = opts?.verbose ?? true
    const pauseUiAround = opts?.pauseUiAround ?? (async fn => fn())
    const apiKey = readRuntimeKeyOrBail()

    const dataDir = resolveDataDir()
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
            if (input) {
                await deliverInput(rt, input, isVerbose)
            } else {
                await rt.start()
            }
            if (isCliRunCommandEnabled()) return
            await rt.awaitRunResult(workflowRunId)
            if (isVerbose) console.log(chalk.green(`  Run ${workflowRunId} completed`))
        })
    } catch (error) {
        if (error instanceof CliError) throw error
        throw new CliError("run_resume_failed", `Run "${runId}" could not be resumed.`, { detail: formatErrorDetail(error) })
    } finally {
        if (!isCliRunCommandEnabled()) await closeDurableRuntime()
    }
}

function resolveDataDir(): string {
    return process.env.WORKFLOW_LOCAL_DATA_DIR ?? path.join(process.cwd(), ".terse", "data")
}

// Input resumes skip start(): resumeHook re-queues the run itself, and start()'s
// crash-recovery wake would add a concurrent second replay.
async function deliverInput(rt: Awaited<ReturnType<typeof getDurableRuntime>>, input: ResumeHookInput, isVerbose: boolean): Promise<void> {
    try {
        await rt.deliverInput(input.token, input.payload)
        if (isVerbose) console.log(chalk.cyan(`  Delivered input response to hook ${input.token}`))
    } catch (error) {
        // Stale token: recovery replay instead; the run re-parks on its real wait.
        console.log(chalk.yellow(`  Could not deliver input response to hook ${input.token}: ${formatErrorDetail(error)}`))
        await rt.start()
    }
}
