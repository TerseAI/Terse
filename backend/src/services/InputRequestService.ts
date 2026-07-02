import { SdkInputRequestExpireBody, SdkInputRequestRegisterBody, SdkInputResponsePayload } from "terse-types/types"

import logger from "../common/logger"
import { deliverSlackInputRequest, finalizeSlackInputRequestMessage, getSlackBotClientForOrganization } from "../integrations/slack/inputRequests"
import { db } from "../loaders/prisma"
import { claimSuspendedRun, markRunFailed } from "../modules/agents/AgentRunner/runHistory"

import { resumeSdkRun } from "./SdkJobExecutionService"

export type InputResolveOutcome = "resumed" | "run_finished" | "gave_up" | "unresumable"

export async function registerInputRequest(organizationId: string, body: SdkInputRequestRegisterBody): Promise<{ ok: true; channelId: string; messageTs: string } | { ok: false; error: string }> {
    const run = await findRunInOrganization(body.runId, organizationId)
    if (!run) return { ok: false, error: "Run not found" }

    return deliverSlackInputRequest({ organizationId, jobName: run.jobName, body })
}

// A response can beat the run's own suspension POST (a fast click lands while the run is
// still executing toward its race sleep), so an unclaimed run in progress is retried until
// it parks instead of being dropped.
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
        const claimed = await claimSuspendedRun(runId)
        if (claimed) {
            const record = await db().run_history_records.findUnique({ where: { id: runId }, select: { suspend_image_id: true } })
            // Suspension refuses to park without a snapshot, so a claimed run missing one is
            // corrupted state that can never resume; fail it loudly instead of dropping the response.
            if (!record?.suspend_image_id) {
                logger.error("[InputRequest] Claimed suspended run has no journal snapshot", { runId, token })
                await markRunFailed(runId, "Suspended run has no journal snapshot; the input response could not be delivered", "agent")
                return "unresumable"
            }
            void resumeSdkRun(runId, record.suspend_image_id, { token, payload: response }).catch(error => {
                logger.error("[InputRequest] Failed to resume run for input response", { error, runId, token })
            })
            return "resumed"
        }

        const status = await readRunStatus(runId, organizationId)
        if (status !== "in_progress" && status !== "awaiting_approval") {
            logger.warn("[InputRequest] Response arrived for a run that is no longer waiting", { runId, status, token })
            return "run_finished"
        }
        await delay(RESOLVE_CLAIM_RETRY_DELAY_MS)
    }

    logger.error("[InputRequest] Gave up waiting for run to suspend after input response", { runId, token })
    return "gave_up"
}

export async function expireInputRequest(organizationId: string, body: SdkInputRequestExpireBody): Promise<{ ok: boolean; error?: string }> {
    const run = await findRunInOrganization(body.runId, organizationId)
    if (!run) return { ok: false, error: "Run not found" }

    const client = await getSlackBotClientForOrganization(organizationId)
    if (!client) return { ok: false, error: "No Slack integration is connected for this organization." }

    const updated = await finalizeSlackInputRequestMessage(client, body.delivery.channelId, body.delivery.messageTs, ":hourglass: Timed out waiting for a response.")
    return { ok: updated, error: updated ? undefined : "Failed to update the Slack message." }
}

// helpers

async function findRunInOrganization(runId: string, organizationId: string): Promise<{ jobName: string } | null> {
    const run = await db().run_history_records.findFirst({
        where: { id: runId, automation: { organization_id: organizationId } },
        select: { automation: { select: { name: true } } }
    })
    if (!run?.automation) return null
    return { jobName: run.automation.name }
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
