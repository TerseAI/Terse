import { SdkInputRequestRegisterBody, SdkInputResponsePayload } from "terse-types/types"

import logger from "../common/logger"
import { db } from "../loaders/prisma"
import { claimSuspendedRun, markRunFailed } from "../modules/agents/AgentRunner/runHistory"
import { enqueueRunExecution } from "../tasks/queues/runExecutionQueue"

import { getInputRequestProvider } from "./inputRequestProviders/InputRequestProviderRegistry"
import { InputRequestDeliverResult } from "./inputRequestProviders/types"

export type InputResolveOutcome = "resumed" | "run_finished" | "gave_up" | "unresumable"

export async function registerInputRequest(organizationId: string, body: SdkInputRequestRegisterBody): Promise<InputRequestDeliverResult> {
    const run = await findRunInOrganization(body.runId, organizationId)
    if (!run) return { ok: false, error: "Run not found" }

    const provider = getInputRequestProvider(body.via.provider)
    if (!provider) return { ok: false, error: `No input provider is registered for "${body.via.provider}".` }

    return provider.deliver({ organizationId, jobName: run.jobName, body })
}

// A response can beat the run's own parking (a fast click lands while the run is still
// executing toward its park), so a run still in progress is retried until it suspends
// instead of being dropped.
const RESOLVE_CLAIM_ATTEMPTS = 24
const RESOLVE_CLAIM_RETRY_DELAY_MS = 5_000

export async function resolveInputRequest(params: { organizationId: string; runId: string; token: string; response: SdkInputResponsePayload }): Promise<InputResolveOutcome> {
    const { organizationId, runId, token, response } = params

    const run = await findRunInOrganization(runId, organizationId)
    if (!run) {
        logger.warn("[InputRequest] Resolve rejected: run not in organization", { runId, organizationId })
        return "run_finished"
    }

    let attempt = 0
    while (attempt < RESOLVE_CLAIM_ATTEMPTS) {
        attempt++
        const status = await readRunStatus(runId, organizationId)
        if (status === "suspended") return enqueueInputResume(run, runId, token, response)

        if (status !== "in_progress" && status !== "awaiting_approval") {
            logger.warn("[InputRequest] Response arrived for a run that is no longer waiting", { runId, status, token })
            return "run_finished"
        }
        await delay(RESOLVE_CLAIM_RETRY_DELAY_MS)
    }

    logger.error("[InputRequest] Gave up waiting for run to suspend after input response", { runId, token })
    return "gave_up"
}

// The resume rides the run execution queue so it survives a backend crash and dedupes on
// singleton key; the queue handler is the single place that claims the suspended run.
async function enqueueInputResume(run: RunForInput, runId: string, token: string, response: SdkInputResponsePayload): Promise<InputResolveOutcome> {
    const suspension = await db().run_suspensions.findFirst({
        where: { run_id: runId, resumed_at: null },
        orderBy: { created_at: "desc" }
    })

    // Suspension refuses to park without a snapshot, so a suspended run missing one is
    // corrupted state that can never resume; fail it loudly instead of dropping the response.
    if (!suspension?.suspend_image_id) {
        logger.error("[InputRequest] Suspended run has no journal snapshot", { runId, token })
        await claimSuspendedRun(runId)
        await markRunFailed(runId, "Suspended run has no journal snapshot; the input response could not be delivered", "agent")
        return "unresumable"
    }

    await enqueueRunExecution({
        runId,
        agentId: run.agentId,
        orgId: run.organizationId,
        userId: run.userId,
        jobName: run.jobName,
        kind: "sandbox",
        restoreImageId: suspension.suspend_image_id,
        hookResume: { token, payload: response }
    })
    return "resumed"
}

// helpers

async function findRunInOrganization(runId: string, organizationId: string): Promise<RunForInput | null> {
    const run = await db().run_history_records.findFirst({
        where: { id: runId, automation: { organization_id: organizationId } },
        select: { automation: { select: { id: true, name: true, user_id: true } } }
    })
    if (!run?.automation) return null
    return { agentId: run.automation.id, jobName: run.automation.name, userId: run.automation.user_id, organizationId }
}

async function readRunStatus(runId: string, organizationId: string) {
    const record = await db().run_history_records.findFirst({
        where: { id: runId, automation: { organization_id: organizationId } },
        select: { status: true }
    })
    return record?.status ?? null
}

function delay(durationMs: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, durationMs))
}

type RunForInput = {
    agentId: string
    jobName: string
    userId: string
    organizationId: string
}
