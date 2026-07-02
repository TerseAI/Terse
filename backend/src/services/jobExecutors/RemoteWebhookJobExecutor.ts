import type { ChatSnippet, WebhookFailureStage } from "terse-types/ModelEvents"
import { SdkJobServerCheckStep, webhookJobTriggerResponseSchema } from "terse-types/types"

import logger from "../../common/logger"
import { safeFetch } from "../../common/safeFetch"
import { extractErrorMessage } from "../../common/strings"
import { parseSerializedTriggerPayload } from "../../common/triggerPayload"
import { buildSignatureHeaders } from "../../common/webhookHmac"
import { db } from "../../loaders/prisma"
import { emitAndPersistSnippetEvent } from "../../modules/agents/systemEvents/emitAndPersistSnippetEvent"
import { WEBHOOK_JOB_FETCH_TIMEOUT_MS, runWebhookJobHandshakeChallenge } from "../webhookJobHandshakeChallenge"

import { JobExecutionContext, JobExecutionKind, JobExecutor, RunOutcome } from "./types"

export class RemoteWebhookJobExecutor implements JobExecutor {
    readonly kind: JobExecutionKind = "remote-webhook"

    async execute(context: JobExecutionContext): Promise<RunOutcome> {
        const { runId, agent, orgId, jobName } = context

        const remoteServerUrl = agent.project.remote_server_url
        const signingSecret = agent.project.signing_secret
        if (!remoteServerUrl || !signingSecret) {
            const reason = !remoteServerUrl ? `Webhook agent "${agent.name}" is missing remote_server_url` : `Webhook agent "${agent.name}" is missing signing_secret`
            return { status: "failed", cause: new Error(reason) }
        }

        const runRecord = await db().run_history_records.findUnique({ where: { id: runId }, select: { trigger_payload: true } })
        const event = parseSerializedTriggerPayload(runRecord?.trigger_payload ?? null)
        if (!event) {
            return { status: "failed", cause: new Error(`Webhook agent "${agent.name}" has no trigger payload to deliver`) }
        }

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
                logger.error("Webhook job: handshake failed", {
                    runId,
                    agentId: agent.id,
                    triggerUrl: challenge.triggerUrl,
                    step: challenge.step,
                    httpStatus: challenge.httpStatus
                })
                return { status: "failed", cause: new Error(challenge.message) }
            }

            currentStage = "delivery"
            logger.info("Challenge successful, delivering event", { runId, agentId: agent.id })

            const deliverController = new AbortController()
            const deliverTimeout = setTimeout(() => deliverController.abort(), WEBHOOK_JOB_FETCH_TIMEOUT_MS)
            const deliverBody = JSON.stringify({ jobName, runId, event })
            let deliverResponse: Response
            try {
                // Reuse the validated + IP-pinned context from the handshake.
                // safeFetch enforces redirect: 'manual' and pins TCP connect
                // to the address the validator approved — closes DNS rebinding.
                deliverResponse = await safeFetch(challenge.validatedTrigger, {
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

            // 3xx responses are not followed (safeFetch enforces redirect: manual).
            // Treat them as a failure rather than letting the agent silently miss
            // the delivery.
            if (deliverResponse.status >= 300 && deliverResponse.status < 400) {
                const failureMessage = `Webhook delivery returned HTTP ${deliverResponse.status}. Redirects are not followed; the job server must accept the delivery directly.`
                await emitWebhookFailureSnippet({
                    runId,
                    orgId,
                    agentId: agent.id,
                    stage: "delivery",
                    message: failureMessage,
                    triggerUrl: knownTriggerUrl,
                    httpStatus: deliverResponse.status
                })
                logger.error("Webhook job: delivery 3xx (redirect refused)", { runId, agentId: agent.id, status: deliverResponse.status })
                return { status: "failed", cause: new Error(failureMessage) }
            }

            if (!deliverResponse.ok) {
                // Intentionally do NOT include the response body in the
                // snippet or error message. Echoing it turns webhook
                // delivery into an SSRF data-exfiltration channel.
                const failureMessage = `Webhook delivery returned HTTP ${deliverResponse.status} (${deliverResponse.statusText || "error"}).`
                await emitWebhookFailureSnippet({
                    runId,
                    orgId,
                    agentId: agent.id,
                    stage: "delivery",
                    message: failureMessage,
                    triggerUrl: knownTriggerUrl,
                    httpStatus: deliverResponse.status
                })
                logger.error("Webhook job: delivery non-2xx", { runId, agentId: agent.id, status: deliverResponse.status })
                return { status: "failed", cause: new Error(failureMessage) }
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
                logger.info("Webhook job: trigger delivered but job filter skipped the run", { runId, agentId: agent.id, jobName })
                return { status: "skipped", reason: "Job filter excluded this event" }
            }

            logger.info("Webhook job: trigger delivered; awaiting SDK agent run for completion", { runId, agentId: agent.id, jobName })
            return { status: "success" }
        } catch (error) {
            const errorMessage = error instanceof Error && error.name === "AbortError" ? "Webhook request timed out" : extractErrorMessage(error)

            logger.error("Webhook job execution failed", { error, runId, agentId: agent.id, stage: currentStage })

            await emitWebhookFailureSnippet({
                runId,
                orgId,
                agentId: agent.id,
                stage: currentStage,
                message: errorMessage,
                triggerUrl: knownTriggerUrl
            })

            return { status: "failed", cause: error }
        }
    }
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
