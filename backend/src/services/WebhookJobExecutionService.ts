import { RunHistoryStatus } from "terse-types/RunHistoryTypes"
import { User, webhookJobTriggerResponseSchema } from "terse-types/types"

import { finalizeRunStatus, markRunFailed } from "../agent/AgentRunner/runHistory"
import logger from "../logger"
import { db } from "../prismaClient"
import { emitCacheInvalidationWithWildcard } from "../realtimeSocket"
import { hashToken } from "../utility/apiTokens"
import { extractErrorMessage } from "../utility/strings"

export interface WebhookJobExecutionParams {
    jobUrl: string
    runId: string
    agentId: string
    orgId: string
    user: User
    eventJson: string
    jobName: string
}

const WEBHOOK_TIMEOUT_MS = 30_000

export class WebhookJobExecutionService {
    async execute(params: WebhookJobExecutionParams): Promise<void> {
        const { jobUrl, runId, agentId, orgId, eventJson, jobName } = params

        try {
            const event = JSON.parse(eventJson)

            const controller = new AbortController()
            const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS)

            let response: Response
            try {
                response = await fetch(jobUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ jobName, runId, event }),
                    signal: controller.signal
                })
            } finally {
                clearTimeout(timeout)
            }

            if (!response.ok) {
                const body = await response.text().catch(() => "")
                const detail = body.slice(0, 500)
                await markRunFailed(runId, `Webhook returned ${response.status}: ${detail}`, "agent")
                emitCacheInvalidationWithWildcard(orgId, "runHistory", agentId)
                logger.error("Webhook job: non-2xx response", { runId, agentId, status: response.status, detail })
                return
            }

            let json: unknown
            try {
                json = await response.json()
            } catch {
                await markRunFailed(runId, "Webhook returned invalid JSON response", "agent")
                emitCacheInvalidationWithWildcard(orgId, "runHistory", agentId)
                logger.error("Webhook job: invalid JSON response", { runId, agentId })
                return
            }

            const parsedResponse = webhookJobTriggerResponseSchema.safeParse(json)
            if (!parsedResponse.success) {
                const details = parsedResponse.error.issues.map(i => i.message).join("; ")
                await markRunFailed(runId, `Webhook response failed validation: ${details}`, "agent")
                emitCacheInvalidationWithWildcard(orgId, "runHistory", agentId)
                logger.error("Webhook job: response validation failed", { runId, agentId, issues: parsedResponse.error.issues })
                return
            }

            const responseBody = parsedResponse.data

            // Verify the API key belongs to the same org
            const tokenHash = hashToken(responseBody.apiKey)
            const token = await db().api_tokens.findUnique({
                where: { token_hash: tokenHash }
            })

            if (!token) {
                await markRunFailed(runId, "Webhook handshake failed: invalid API key", "agent")
                emitCacheInvalidationWithWildcard(orgId, "runHistory", agentId)
                logger.error("Webhook job: API key not found", { runId, agentId })
                return
            }

            if (token.organization_id !== orgId) {
                await markRunFailed(runId, "Webhook handshake failed: API key does not belong to this organization", "agent")
                emitCacheInvalidationWithWildcard(orgId, "runHistory", agentId)
                logger.error("Webhook job: org mismatch", { runId, agentId, tokenOrg: token.organization_id, expectedOrg: orgId })
                return
            }

            // Handshake verified, trigger delivered successfully
            await finalizeRunStatus(runId, RunHistoryStatus.SUCCESS)
            emitCacheInvalidationWithWildcard(orgId, "runHistory", agentId)
            logger.info("Webhook job: trigger delivered and verified", { runId, agentId, jobName })
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
