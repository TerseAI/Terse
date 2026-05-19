import { SerializedEvent } from "terse-types"
import type { ChatSnippet, WebhookFailureStage } from "terse-types/ModelEvents"
import { RunHistoryStatus } from "terse-types/RunHistoryTypes"
import { SdkJobServerCheckStep, User, webhookJobTriggerResponseSchema } from "terse-types/types"

import { finalizeRunStatus, markRunSkipped } from "../agent/AgentRunner/runHistory"
import { classifyAgentError } from "../agent/agentErrorUtils"
import { emitAndPersistSnippetEvent } from "../agent/systemEvents/emitAndPersistSnippetEvent"
import logger from "../logger"
import { emitCacheInvalidationWithWildcard, finalizeRunFailure } from "../realtimeSocket"
import { AgentWithRelations } from "../types/prisma"
import { extractErrorMessage } from "../utility/strings"
import { buildSignatureHeaders } from "../utility/webhookHmac"

import { WEBHOOK_JOB_FETCH_TIMEOUT_MS, runWebhookJobHandshakeChallenge } from "./webhookJobHandshakeChallenge"

interface WebhookJobExecutionParams {
    remoteServerUrl: string
    runId: string
    agent: AgentWithRelations
    orgId: string
    user: User
    event: SerializedEvent
    jobName: string
    signingSecret: string
}

export class WebhookJobExecutionService {
    async execute(params: WebhookJobExecutionParams): Promise<void> {
        const { remoteServerUrl, runId, agent, orgId, user, event, jobName, signingSecret } = params

        // Tracks the most recently entered stage so the unhandled-error catch block at the bottom
        // can attribute thrown exceptions to the right stage in the run-history snippet.
        let currentStage: WebhookFailureStage = "handshake"
        let knownTriggerUrl: string = remoteServerUrl

        try {
            const challenge = await runWebhookJobHandshakeChallenge({ remoteServerUrl, signingSecret })
            knownTriggerUrl = challenge.triggerUrl
            logger.info("Webhook job: handshake then deliver", { runId, agentId: agent.id, triggerUrl: challenge.triggerUrl })

            if (!challenge.ok) {
                await emitWebhookFailureSnippet({
                    runId,
                    orgId,
                    agentId: agent.id,
                    stage: "handshake",
                    message: challenge.message,
                    triggerUrl: challenge.triggerUrl,
                    step: challenge.step,
                    httpStatus: challenge.httpStatus
                })
                await finalizeRunFailure(runId, classifyAgentError(new Error(challenge.message)), user, agent)
                logger.error("Webhook job: handshake failed", {
                    runId,
                    agentId: agent.id,
                    triggerUrl: challenge.triggerUrl,
                    step: challenge.step,
                    httpStatus: challenge.httpStatus
                })
                return
            }

            currentStage = "delivery"
            logger.info("Challenge successful, delivering event", { runId, agentId: agent.id, event })

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
                const failureMessage = `Webhook delivery returned ${deliverResponse.status}`
                await emitWebhookFailureSnippet({
                    runId,
                    orgId,
                    agentId: agent.id,
                    stage: "delivery",
                    message: failureMessage,
                    triggerUrl: knownTriggerUrl,
                    httpStatus: deliverResponse.status,
                    bodySnippet: detail || undefined
                })
                await finalizeRunFailure(runId, classifyAgentError(new Error(`${failureMessage}: ${detail}`)), user, agent)
                logger.error("Webhook job: delivery non-2xx", { runId, agentId: agent.id, status: deliverResponse.status, detail })
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
                logger.info("Webhook job: trigger delivered but job filter skipped the run", { runId, agentId: agent.id, jobName })
                emitCacheInvalidationWithWildcard(orgId, "runHistory", agent.id)
                return
            } else {
                logger.info("Webhook job: trigger delivered; awaiting SDK agent run for completion", { runId, agentId: agent.id, jobName })
            }

            await finalizeRunStatus(runId, RunHistoryStatus.SUCCESS)
            emitCacheInvalidationWithWildcard(orgId, "runHistory", agent.id)
        } catch (error) {
            const errorMessage = error instanceof Error && error.name === "AbortError" ? "Webhook request timed out" : extractErrorMessage(error)

            logger.error("Webhook job execution failed", { error, runId, agentId: agent.id, stage: currentStage })

            try {
                await emitWebhookFailureSnippet({
                    runId,
                    orgId,
                    agentId: agent.id,
                    stage: currentStage,
                    message: errorMessage,
                    triggerUrl: knownTriggerUrl
                })
                await finalizeRunFailure(runId, classifyAgentError(error), user, agent)
            } catch (e) {
                logger.error("Failed to mark webhook run as failed", { error: e, runId })
            }
        }
    }
}

interface EmitWebhookFailureSnippetInput {
    runId: string
    orgId: string
    agentId: string
    stage: WebhookFailureStage
    message: string
    triggerUrl: string
    step?: SdkJobServerCheckStep
    httpStatus?: number
    bodySnippet?: string
}

async function emitWebhookFailureSnippet(input: EmitWebhookFailureSnippetInput): Promise<void> {
    const snippet: ChatSnippet = {
        type: "webhook_failure",
        stage: input.stage,
        message: input.message,
        triggerUrl: input.triggerUrl,
        ...(input.step ? { step: input.step } : {}),
        ...(input.httpStatus !== undefined ? { httpStatus: input.httpStatus } : {}),
        ...(input.bodySnippet ? { bodySnippet: input.bodySnippet } : {})
    }

    try {
        await emitAndPersistSnippetEvent({
            runId: input.runId,
            organizationId: input.orgId,
            agentId: input.agentId,
            snippet
        })
    } catch (error) {
        logger.warn("emitWebhookFailureSnippet: failed to emit/persist webhook failure snippet", {
            runId: input.runId,
            agentId: input.agentId,
            stage: input.stage,
            error
        })
    }
}
