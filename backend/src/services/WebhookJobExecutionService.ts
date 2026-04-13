import { SerializedEvent } from "terse-types"
import { RunHistoryStatus } from "terse-types/RunHistoryTypes"
import { User, webhookJobTriggerResponseSchema } from "terse-types/types"

import { finalizeRunStatus, markRunFailed, markRunSkipped } from "../agent/AgentRunner/runHistory"
import logger from "../logger"
import { emitCacheInvalidationWithWildcard } from "../realtimeSocket"
import { extractErrorMessage } from "../utility/strings"
import { buildSignatureHeaders } from "../utility/webhookHmac"

import { WEBHOOK_JOB_FETCH_TIMEOUT_MS, runWebhookJobHandshakeChallenge } from "./webhookJobHandshakeChallenge"

export interface WebhookJobExecutionParams {
    remoteServerUrl: string
    runId: string
    agentId: string
    orgId: string
    user: User
    event: SerializedEvent
    jobName: string
    signingSecret: string
}

export class WebhookJobExecutionService {
    async execute(params: WebhookJobExecutionParams): Promise<void> {
        const { remoteServerUrl, runId, agentId, orgId, event, jobName, signingSecret } = params

        try {
            const challenge = await runWebhookJobHandshakeChallenge({ remoteServerUrl, signingSecret })
            logger.info("Webhook job: handshake then deliver", { runId, agentId, triggerUrl: challenge.triggerUrl })

            if (!challenge.ok) {
                await markRunFailed(runId, challenge.message, "agent")
                emitCacheInvalidationWithWildcard(orgId, "runHistory", agentId)
                logger.error("Webhook job: handshake failed", {
                    runId,
                    agentId,
                    triggerUrl: challenge.triggerUrl,
                    step: challenge.step,
                    httpStatus: challenge.httpStatus
                })
                return
            }

            logger.info("Challenge successful, delivering event", { runId, agentId, event })

            const deliverController = new AbortController()
            const deliverTimeout = setTimeout(() => deliverController.abort(), WEBHOOK_JOB_FETCH_TIMEOUT_MS)
            const deliverBody = JSON.stringify({ jobName, runId, event })
            let deliverResponse: Response
            try {
                deliverResponse = await fetch(challenge.triggerUrl, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        ...buildSignatureHeaders(signingSecret, deliverBody)
                    },
                    body: deliverBody,
                    signal: deliverController.signal
                })
            } finally {
                clearTimeout(deliverTimeout)
            }

            if (!deliverResponse.ok) {
                const body = await deliverResponse.text().catch(() => "")
                const detail = body.slice(0, 500)
                await markRunFailed(runId, `Webhook delivery returned ${deliverResponse.status}: ${detail}`, "agent")
                emitCacheInvalidationWithWildcard(orgId, "runHistory", agentId)
                logger.error("Webhook job: delivery non-2xx", { runId, agentId, status: deliverResponse.status, detail })
                return
            }

            // Consume the body and check for filter-skip. Do not mark SUCCESS here — self-hosted jobs run via
            // POST /sdk/agent-run (X-Terse-Run-Id), which finalizes status when the agent actually finishes.
            const rawBody = await deliverResponse.text().catch(() => "")
            let parsed: unknown
            try {
                parsed = rawBody ? JSON.parse(rawBody) : undefined
            } catch {
                /* non-JSON body is fine */
            }
            const triggerResponse = webhookJobTriggerResponseSchema.safeParse(parsed)
            const filtered = triggerResponse.success && triggerResponse.data.filtered === true

            if (filtered) {
                await markRunSkipped(runId, "Job filter excluded this event")
                logger.info("Webhook job: trigger delivered but job filter skipped the run", { runId, agentId, jobName })
                emitCacheInvalidationWithWildcard(orgId, "runHistory", agentId)
                return
            } else {
                logger.info("Webhook job: trigger delivered; awaiting SDK agent run for completion", { runId, agentId, jobName })
            }

            await finalizeRunStatus(runId, RunHistoryStatus.SUCCESS)
            emitCacheInvalidationWithWildcard(orgId, "runHistory", agentId)
        } catch (error) {
            const errorMessage = error instanceof Error && error.name === "AbortError" ? "Webhook request timed out" : extractErrorMessage(error)

            logger.error("Webhook job execution failed", { error, runId, agentId })

            try {
                await markRunFailed(runId, errorMessage, "agent")
                emitCacheInvalidationWithWildcard(orgId, "runHistory", agentId)
            } catch (e) {
                logger.error("Failed to mark webhook run as failed", { error: e, runId })
            }
        }
    }
}
