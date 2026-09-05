import chalk from "chalk"
import { Runtime } from "little-durable"
import type { RuntimeOutcome, Suspension } from "little-durable"
import { DurableObjectJournalStore, __fetchRegisteredDurableWorkflow, __inputRequestHook, fetchRegisteredJobs } from "terse-sdk"
import type { CreateJobParameters, TerseJobContext } from "terse-sdk"
import { runWithJobContext } from "terse-sdk/dist/runIdentity/jobContextStore.js"
import type { SdkJobSuspendRequestBody, SdkJobSuspendResponseBody } from "terse-types"
import { ApiRoutes } from "terse-types"

import { fetchWithAuth, readRuntimeKeyOrBail } from "../../../api.js"
import { CliError } from "../../../cliError.js"
import { BACKEND_URL } from "../../../config.js"
import { readProjectConfig } from "../../../projectConfig.js"
import { shouldRunTerseWorkflow } from "../terseWorkflow.js"

import { type JobRuntime, type ResumeHookInput, type ResumeRunOptions, formatErrorDetail } from "./JobRuntime.js"
import { withSession } from "./session.js"

export const durableJobRuntime: JobRuntime = {
    async executeJob(job, runId, event, opts) {
        if (!runId) throw new CliError("durable_run_id_missing", "Durable execution requires a run ID.")

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
                    const journalStore = new DurableObjectJournalStore()
                    const runtime = new Runtime({ journalStore })
                    const context = jobContext({ sessionId, runId, job, projectId: opts?.projectId })
                    const shouldRun = await shouldRunTerseWorkflow({ job, event, context })
                    if (!shouldRun) return
                    const workflow = __fetchRegisteredDurableWorkflow(job.name)
                    if (!workflow) throw new Error(`No durable workflow was registered for job "${job.name}".`)

                    const outcome = await runWithJobContext(context, () => runtime.start(workflow, { runId, input: event }).waitForOutcome())
                    await handleOutcome({ runId, outcome, apiKey })
                },
                opts?.onSessionEvent,
                opts?.session
            )
        } catch (error) {
            if (error instanceof CliError) throw error
            throw new CliError("job_execution_failed", `Job "${job.name}" threw an error.`, { detail: formatErrorDetail(error) })
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

    try {
        await withSession(apiKey, isVerbose, pauseUiAround, async sessionId => {
            const journalStore = new DurableObjectJournalStore()
            const runtime = new Runtime({ journalStore })
            const run = await runtime.getRun({ runId })
            const job = fetchRegisteredJobs().get(run.workflowName)
            if (!job) throw new Error(`No registered job matches durable workflow "${run.workflowName}".`)
            const workflow = __fetchRegisteredDurableWorkflow(job.name)
            if (!workflow) throw new Error(`No durable workflow was registered for job "${job.name}".`)

            if (isVerbose) console.log(chalk.cyan(`  Resuming run ${runId}`))
            const context = jobContext({ sessionId, runId, job, projectId: readProjectConfig()?.projectId })
            const outcome = await runWithJobContext(context, async (): Promise<RuntimeOutcome> => {
                const suspension = await runtime.getSuspension({ runId })

                if (input) {
                    if (!suspension || suspension.request.name !== __inputRequestHook.name) {
                        throw new Error(`No unresolved input wait with token "${input.token}" exists in run "${runId}".`)
                    }
                    const request = __inputRequestHook.request.safeParse(suspension.request.payload)
                    if (!request.success || request.data.token !== input.token) {
                        throw new Error(`No unresolved input wait with token "${input.token}" exists in run "${runId}".`)
                    }
                    const resolution = __inputRequestHook.resolution.parse(input.payload)
                    return runtime.resumeHook(__inputRequestHook, { runId, workflow, waitId: suspension.waitId, resolution }).waitForOutcome()
                }

                return suspension?.request.name === "timer"
                    ? runtime.resumeTimer(workflow, { runId, waitId: suspension.waitId }).waitForOutcome()
                    : runtime.resume(workflow, { runId }).waitForOutcome()
            })

            await handleOutcome({ runId, outcome, apiKey })

            if (isVerbose && outcome.status === "completed") console.log(chalk.green(`  Run ${runId} completed`))
        })
    } catch (error) {
        if (error instanceof CliError) throw error
        throw new CliError("run_resume_failed", `Run "${runId}" could not be resumed.`, { detail: formatErrorDetail(error) })
    }
}

function jobContext({ sessionId, runId, job, projectId }: { sessionId: string; runId: string; job: CreateJobParameters; projectId?: string }): TerseJobContext {
    return {
        sessionId,
        runId,
        apiBaseUrl: BACKEND_URL,
        jobName: job.name,
        projectId
    }
}

async function handleOutcome({ runId, outcome, apiKey }: { runId: string; outcome: RuntimeOutcome; apiKey: string }): Promise<void> {
    if (outcome.status === "completed") return
    if (outcome.status === "failed") {
        const error = new Error(outcome.error.message)
        error.name = outcome.error.name
        throw error
    }

    const body = suspendRequest({ runId, suspension: outcome.suspension })
    await fetchWithAuth<SdkJobSuspendResponseBody>(ApiRoutes.SDK.SUSPEND, apiKey, body, "POST")
}

function suspendRequest({ runId, suspension }: { runId: string; suspension: Suspension }): SdkJobSuspendRequestBody {
    const payload = suspension.request.payload
    if (suspension.request.name === "timer") {
        if (typeof payload !== "object" || payload === null || Array.isArray(payload) || typeof payload.wakeAt !== "string") {
            throw new Error("Timer suspension has an invalid wakeAt.")
        }
        return {
            runId,
            kind: "timer",
            delaySeconds: Math.max(1, Math.ceil((Date.parse(payload.wakeAt) - Date.now()) / 1_000)),
            idempotencyKey: suspension.waitId
        }
    }

    if (suspension.request.name === __inputRequestHook.name) {
        const input = __inputRequestHook.request.parse(payload)
        return {
            runId,
            kind: "input",
            hookToken: input.token,
            idempotencyKey: suspension.waitId
        }
    }

    throw new Error(`Terse does not know how to park hook "${suspension.request.name}".`)
}
