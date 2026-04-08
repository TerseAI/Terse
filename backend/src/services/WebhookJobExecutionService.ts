import { RunHistoryStatus } from "terse-types/RunHistoryTypes"
import { User } from "terse-types/types"

import { finalizeRunStatus, markRunFailed } from "../agent/AgentRunner/runHistory"
import logger from "../logger"
import { emitCacheInvalidationWithWildcard } from "../realtimeSocket"
import { extractErrorMessage } from "../utility/strings"

import { WEBHOOK_JOB_FETCH_TIMEOUT_MS, runWebhookJobHandshakeChallenge } from "./webhookJobHandshakeChallenge"

export interface WebhookJobExecutionParams {
    jobUrl: string
    runId: string
    agentId: string
    orgId: string
    user: User
    eventJson: string
    jobName: string
}

export class WebhookJobExecutionService {
    async execute(params: WebhookJobExecutionParams): Promise<void> {
        const { jobUrl, runId, agentId, orgId, eventJson, jobName } = params

        try {
            const event = JSON.parse(eventJson)

            const challenge = await runWebhookJobHandshakeChallenge({ jobUrl, organizationId: orgId })
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
            let deliverResponse: Response
            try {
                deliverResponse = await fetch(challenge.triggerUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ jobName, runId, event }),
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

            await finalizeRunStatus(runId, RunHistoryStatus.SUCCESS)
            emitCacheInvalidationWithWildcard(orgId, "runHistory", agentId)
            logger.info("Webhook job: handshake verified and trigger delivered", { runId, agentId, jobName })
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
