import { Request, Response } from "express"
import crypto from "node:crypto"
import { BillingError, CreditGateDeniedError } from "terse-types"
import { SkillConfigData } from "terse-types/Configs"
import { RunHistoryAction } from "terse-types/RunHistoryTypes"
import { SdkAgentRunResponseBody, SdkAgentStreamEvent, User, sdkAgentRunRequestBodySchema, sdkApprovalDecisionRequestBodySchema } from "terse-types/types"
import { z } from "zod"

import { SdkAgentRunner } from "../agent/AgentRunner/SdkAgentRunner"
import { appendRunAction, upsertSdkSkills } from "../agent/AgentRunner/runHistory"
import { emitSessionEvent } from "../agent/SessionEventBus"
import { classifyAgentError } from "../agent/agentErrorUtils"
import { CancelReason } from "../agent/cancellation/RunCancellationTaskQueue"
import { markRunCancelledAndInvalidate } from "../agent/cancellation/runCancellationEffects"
import logger from "../logger"
import { db } from "../prismaClient"
import { finalizeRunFailure } from "../realtimeSocket"
import { type BillingService, billingServiceProxyForOrganization } from "../services/BillingService"
import { extractErrorMessage } from "../utility/strings"

import { resolveApprovalDecision, waitForApprovalDecision } from "./sdkApprovalGate"

/**
 * POST /sdk/agent-run
 *
 * Streams the agent run over SSE. If the agent requests tool approval,
 * the stream stays open while we wait for a decision via POST /sdk/approval-decision.
 * On receiving the decision, the agent resumes and continues streaming.
 */
const sdkAgentRunInputSchema = sdkAgentRunRequestBodySchema.extend({
    prompt: z.string().min(1)
})

export async function handleSdkAgentRun(req: Request, res: Response) {
    const user = req.session?.user as User | undefined
    if (!user) {
        return res.status(401).json({ success: false, error: "Unauthorized" })
    }

    const parsed = sdkAgentRunInputSchema.safeParse(req.body)
    if (!parsed.success) {
        const response: SdkAgentRunResponseBody = {
            success: false,
            error: "Invalid request body",
            details: parsed.error.issues.map(i => i.message)
        }
        return res.status(400).json(response)
    }

    const headerRunId = req.headers["x-terse-run-id"] as string | undefined
    const productionRunContext = headerRunId ? await resolveProductionRunContext(headerRunId, user) : null
    if (headerRunId && !productionRunContext) {
        return res.status(404).json({ success: false, error: "Run not found" })
    }

    const { data } = parsed
    const { send, sandboxRunId } = initSseStream(req, res, productionRunContext?.organizationId)
    const isProductionRun = !!sandboxRunId
    const orgId = productionRunContext?.organizationId ?? user.organizationId

    try {
        const runId = isProductionRun ? sandboxRunId : crypto.randomUUID()

        const billingForRunner = billingServiceProxyForOrganization(orgId, user.workosId)

        const sdkRunner = createSdkRunner({
            runId,
            user,
            prompt: data.prompt,
            skills: data.skills ?? [],
            toolApprovals: data.toolApprovals ?? [],
            send,
            isProductionRun,
            options: data.options,
            outputSchema: data.outputSchema,
            billing: billingForRunner
        })
        send({ type: "run_started", runId })

        if (isProductionRun) {
            void upsertSdkSkills(runId, orgId, data.skills ?? []).catch(err => {
                logger.warn("Failed to persist SDK skills for run", { error: err, runId })
            })
        }

        let result = await sdkRunner.run(data.message)

        // Approval loop: keep the stream open while awaiting decisions
        let hardRejected = false
        while (result.loopResult.status === "awaiting_approval") {
            const interruptions = result.loopResult.interruptions ?? []
            const stepId = (interruptions[0]?.rawItem as any)?.callId as string | undefined
            if (!stepId) {
                send({ type: "error", message: "Approval requested but no stepId found in interruption" })
                break
            }

            const decision = await waitForApprovalDecision(runId, stepId, orgId)
            if (decision.hardReject) {
                if (isProductionRun && productionRunContext) {
                    await markRunCancelledAndInvalidate(runId, productionRunContext.agentId, productionRunContext.organizationId, user.workosId, CancelReason.HARD_REJECT)
                }
                hardRejected = true
                break
            }
            const resumeDecision = decision.approved ? ("approve" as const) : ("reject" as const)
            result = await sdkRunner.resume(resumeDecision, stepId, JSON.stringify(result.loopResult.state), interruptions, decision.rejectionReason)
        }

        if (hardRejected) {
            send({ type: "done" })
            res.end()
            return
        }

        finishSseStream(res, send, result, sdkRunner)
    } catch (error) {
        if (isProductionRun && sandboxRunId) {
            await finalizeFailedProductionRun(sandboxRunId, orgId, user, error)
        }

        if (error instanceof CreditGateDeniedError) {
            send({ type: "error", message: error.message })
            send({ type: "done" })
            res.end()
            return
        }
        if (error instanceof BillingError) {
            send({ type: "error", message: "Billing temporarily unavailable. Please retry shortly." })
            send({ type: "done" })
            res.end()
            return
        }
        const message = extractErrorMessage(error)
        send({ type: "error", message })
        send({ type: "done" })
        res.end()
    }
}

async function finalizeFailedProductionRun(runId: string, organizationId: string, user: User, error: unknown): Promise<void> {
    try {
        const record = await db().run_history_records.findFirst({
            where: { id: runId, automation: { organization_id: organizationId } },
            select: { automation: true }
        })
        if (!record?.automation) return
        await finalizeRunFailure(runId, classifyAgentError(error), user, record.automation)
    } catch (markErr) {
        logger.error("Failed to finalize failed SDK production run", { error: markErr, runId })
    }
}

async function resolveProductionRunContext(headerRunId: string, user: User): Promise<{ runId: string; agentId: string; organizationId: string } | null> {
    if (!user.organizationId) return null

    const runRecord = await db().run_history_records.findFirst({
        where: { id: headerRunId, automation: { organization_id: user.organizationId } },
        select: { id: true, automation_id: true, automation: { select: { organization_id: true } } }
    })
    if (!runRecord?.automation.organization_id) {
        logger.warn("[sdk/agent-run] Rejecting cross-tenant x-terse-run-id header", {
            requestedRunId: headerRunId,
            userId: user.id,
            organizationId: user.organizationId
        })
        return null
    }

    return { runId: runRecord.id, agentId: runRecord.automation_id, organizationId: runRecord.automation.organization_id }
}

/**
 * POST /sdk/approval-decision
 *
 * Lightweight endpoint that resolves the in-process approval gate.
 * The SSE handler (handleSdkAgentRun) is awaiting this signal to resume.
 */
export async function handleSdkApprovalDecision(req: Request, res: Response) {
    const user = req.session?.user as User | undefined
    if (!user) {
        return res.status(401).json({ success: false, error: "Unauthorized" })
    }

    const parsed = sdkApprovalDecisionRequestBodySchema.safeParse(req.body)
    if (!parsed.success) {
        return res.status(400).json({ success: false, error: "Missing required fields: runId, stepId, approved" })
    }

    if (!user.organizationId) {
        return res.status(403).json({ success: false, error: "Forbidden" })
    }

    const productionHeaderRunId = req.headers["x-terse-run-id"] as string | undefined
    let resolveOrgId: string
    if (productionHeaderRunId) {
        const runRecord = await db().run_history_records.findFirst({
            where: { id: parsed.data.runId, automation: { organization_id: user.organizationId } },
            select: { automation: { select: { organization_id: true } } }
        })
        const resolvedOrgId = runRecord?.automation?.organization_id
        if (!resolvedOrgId) {
            logger.warn("[sdk/approval-decision] Rejecting cross-tenant approval decision", {
                requestedRunId: parsed.data.runId,
                userId: user.id,
                organizationId: user.organizationId
            })
            return res.status(404).json({ success: false, error: "Run not found" })
        }
        resolveOrgId = resolvedOrgId
    } else {
        resolveOrgId = user.organizationId
    }

    resolveApprovalDecision(parsed.data.runId, parsed.data.stepId, resolveOrgId, { approved: parsed.data.approved })

    return res.status(200).json({ success: true })
}

// Helpers

function initSseStream(
    req: Request,
    res: Response,
    verifiedOrganizationId: string | undefined
): {
    send: (event: SdkAgentStreamEvent) => void
    sessionId: string | undefined
    sandboxRunId: string | undefined
} {
    res.setHeader("Content-Type", "text/event-stream")
    res.setHeader("Cache-Control", "no-cache")
    res.setHeader("Connection", "keep-alive")
    res.flushHeaders()

    const sessionId = req.headers["x-terse-session-id"] as string | undefined
    const sandboxRunId = verifiedOrganizationId ? (req.headers["x-terse-run-id"] as string | undefined) : undefined

    const send = (event: SdkAgentStreamEvent) => {
        res.write(`data: ${JSON.stringify(event)}\n\n`)
        if (sessionId) emitSessionEvent(sessionId, event)

        if (sandboxRunId && verifiedOrganizationId && event.type === "action") {
            void appendRunAction(sandboxRunId, event.action, verifiedOrganizationId).catch(err => {
                logger.warn("Failed to append run action for sandbox run", { error: err, runId: sandboxRunId })
            })
        }
    }

    return { send, sessionId, sandboxRunId }
}

type SdkAgentRunnerResult = Awaited<ReturnType<SdkAgentRunner["run"]>>

function finishSseStream(res: Response, send: (event: SdkAgentStreamEvent) => void, { loopResult }: SdkAgentRunnerResult, sdkRunner: SdkAgentRunner): void {
    if (loopResult.status === "completed") {
        if (loopResult.endedWithToolFailure || sdkRunner.hasToolFailures()) {
            send({ type: "error", message: sdkRunner.getToolFailureSummary() })
        } else {
            const finalOutput = SdkAgentRunner.getFinalOutput(loopResult.result)
            if (finalOutput) {
                send({ type: "final_output", finalOutput })
            }
        }
    }

    send({ type: "done" })
    res.end()
}

function createSdkRunner(params: {
    runId: string
    user: User
    prompt: string
    skills: SkillConfigData[]
    toolApprovals: string[]
    send: (event: SdkAgentStreamEvent) => void
    isProductionRun: boolean
    options?: { maxTurns?: number; requireApproval?: boolean }
    outputSchema?: Record<string, unknown>
    billing: BillingService
}): SdkAgentRunner {
    return new SdkAgentRunner({
        runId: params.runId,
        user: params.user,
        prompt: params.prompt,
        skills: params.skills,
        toolApprovals: params.toolApprovals,
        maxTurns: params.options?.maxTurns ?? 50,
        requireApproval: params.options?.requireApproval ?? true,
        send: params.send,
        isProductionRun: params.isProductionRun,
        outputSchema: params.outputSchema,
        billing: params.billing
    })
}
