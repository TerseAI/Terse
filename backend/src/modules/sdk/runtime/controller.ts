import { Request, Response } from "express"
import crypto from "node:crypto"
import { BillingError, CreditGateDeniedError, IntegrationType, RunHistoryStatus, SdkListenStreamEvent, sdkListenQuerySchema } from "terse-types"
import { SkillConfigData } from "terse-types/Configs"
import { SdkAgentRunResponseBody, SdkAgentStreamEvent, UserSession, sdkAgentRunRequestBodySchema, sdkApprovalDecisionRequestBodySchema } from "terse-types/types"
import { z } from "zod"

import logger from "../../../common/logger"
import { extractErrorMessage } from "../../../common/strings"
import { db } from "../../../loaders/prisma"
import { emitCacheInvalidationWithKey, emitCacheInvalidationWithWildcard, finalizeRunFailure } from "../../../loaders/socket"
import { SdkAgentRunner } from "../../../modules/agents/AgentRunner/SdkAgentRunner"
import { appendRunAction, createRunRecord, finalizeRunStatus, markRunFailed, upsertSdkSkills } from "../../../modules/agents/AgentRunner/runHistory"
import { onListenForwardedEvent } from "../../../modules/agents/ListenBus"
import { emitSessionEvent, onSessionEvent } from "../../../modules/agents/SessionEventBus"
import { classifyAgentError } from "../../../modules/agents/agentErrorUtils"
import { CancelReason } from "../../../modules/agents/cancellation/RunCancellationTaskQueue"
import { markRunCancelledAndInvalidate } from "../../../modules/agents/cancellation/runCancellationEffects"
import { RateLimiterClient } from "../../../rateLimit/RateLimiterClient"
import { type BillingService, billingServiceProxyForOrganization } from "../../../services/BillingService"
import { resolveApprovalDecision, waitForApprovalDecision } from "../approval-gate/queue"
import { ensureTestAutomation, resolveTestRunContext } from "../testRunContext"

const sdkAgentRunInputSchema = sdkAgentRunRequestBodySchema.extend({ prompt: z.string().min(1) })

/** Synthetic trigger metadata for a `terse test` run (the sample event isn't sent to /sdk/agent-run). */
function testRunTrigger(jobName: string) {
    return { event: "test", integration: IntegrationType.TERSE, source: "terse test", title: `Test run: ${jobName}` }
}

export async function handleSdkAgentRun(req: Request, res: Response) {
    const user = req.session?.user
    if (!user) return res.status(401).json({ success: false, error: "Unauthorized" })

    const parsed = sdkAgentRunInputSchema.safeParse(req.body)
    if (!parsed.success) {
        const response: SdkAgentRunResponseBody = { success: false, error: "Invalid request body", details: parsed.error.issues.map(i => i.message) }
        return res.status(400).json(response)
    }

    const headerRunId = req.headers["x-terse-run-id"] as string | undefined
    const productionRunContext = headerRunId ? await resolveProductionRunContext(headerRunId, user) : null
    if (headerRunId && !productionRunContext) return res.status(404).json({ success: false, error: "Run not found" })

    // Both production and test runs resolve to a real run_history_records row. Production runs are
    // pre-created upstream (EventProcessor) and threaded via the x-terse-run-id header; test runs (local
    // `terse test`, no header) mint a row here against a find-or-created draft automation and finalize inline.
    // A `terse test` from a project that isn't linked yet (no project header) still runs, just unrecorded.
    let runContext: ResolvedRunContext
    if (productionRunContext) {
        runContext = { runId: productionRunContext.runId, agentId: productionRunContext.agentId, organizationId: productionRunContext.organizationId, isTest: false, recorded: true }
    } else {
        const testCtx = await resolveTestRunContext(req, user)
        if (testCtx && user.organizationId) {
            const agentId = await ensureTestAutomation(user, testCtx.projectId, testCtx.jobName)
            const runId = await createRunRecord({ agentId, trigger: testRunTrigger(testCtx.jobName), isManuallyTriggered: true, isTest: true })
            emitCacheInvalidationWithWildcard(user.organizationId, "runHistory", agentId)
            emitCacheInvalidationWithKey(user.organizationId, "recentAgents")
            runContext = { runId, agentId, organizationId: user.organizationId, isTest: true, recorded: true }
        } else {
            runContext = { runId: crypto.randomUUID(), agentId: "", organizationId: user.organizationId ?? "", isTest: true, recorded: false }
        }
    }

    const { runId, agentId, organizationId: orgId, isTest, recorded } = runContext
    const isProductionRun = !isTest
    const { data } = parsed
    const { send } = initSseStream(req, res, recorded ? { runId, organizationId: orgId } : null)

    try {
        const billingForRunner = billingServiceProxyForOrganization(orgId, user.id)
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
                if (isProductionRun) {
                    await markRunCancelledAndInvalidate(runId, agentId, orgId, user.id, CancelReason.HARD_REJECT)
                } else if (recorded) {
                    await markRunFailed(runId, "Run rejected at approval gate", "agent")
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

        const succeeded = finishSseStream(res, send, result, sdkRunner)
        // Production success is finalized by SdkJobExecutionService after the sandbox returns; test runs
        // have no such orchestrator, so finalize their terminal status here.
        if (isTest && recorded) await finalizeRunStatus(runId, succeeded ? RunHistoryStatus.SUCCESS : RunHistoryStatus.FAILED)
    } catch (error) {
        if (isProductionRun) {
            await finalizeFailedProductionRun(runId, orgId, user, error)
        } else if (recorded) {
            await markRunFailed(runId, extractErrorMessage(error), "agent")
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
        send({ type: "error", message: extractErrorMessage(error) })
        send({ type: "done" })
        res.end()
    }
}

type ResolvedRunContext = { runId: string; agentId: string; organizationId: string; isTest: boolean; recorded: boolean }

async function finalizeFailedProductionRun(runId: string, organizationId: string, user: UserSession, error: unknown): Promise<void> {
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

async function resolveProductionRunContext(headerRunId: string, user: UserSession): Promise<{ runId: string; agentId: string; organizationId: string } | null> {
    if (!user.organizationId) return null
    const runRecord = await db().run_history_records.findFirst({
        where: { id: headerRunId, automation: { organization_id: user.organizationId } },
        select: { id: true, automation_id: true, automation: { select: { organization_id: true } } }
    })
    if (!runRecord?.automation.organization_id) {
        logger.warn("[sdk/agent-run] Rejecting cross-tenant x-terse-run-id header", { requestedRunId: headerRunId, userId: user.id, organizationId: user.organizationId })
        return null
    }
    return { runId: runRecord.id, agentId: runRecord.automation_id, organizationId: runRecord.automation.organization_id }
}

export async function handleSdkApprovalDecision(req: Request, res: Response) {
    const user = req.session?.user
    if (!user) return res.status(401).json({ success: false, error: "Unauthorized" })

    const parsed = sdkApprovalDecisionRequestBodySchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ success: false, error: "Missing required fields: runId, stepId, approved" })
    if (!user.organizationId) return res.status(403).json({ success: false, error: "Forbidden" })

    const productionHeaderRunId = req.headers["x-terse-run-id"] as string | undefined
    let resolveOrgId: string
    if (productionHeaderRunId) {
        const runRecord = await db().run_history_records.findFirst({
            where: { id: parsed.data.runId, automation: { organization_id: user.organizationId } },
            select: { automation: { select: { organization_id: true } } }
        })
        const resolvedOrgId = runRecord?.automation?.organization_id
        if (!resolvedOrgId) {
            logger.warn("[sdk/approval-decision] Rejecting cross-tenant approval decision", { requestedRunId: parsed.data.runId, userId: user.id, organizationId: user.organizationId })
            return res.status(404).json({ success: false, error: "Run not found" })
        }
        resolveOrgId = resolvedOrgId
    } else {
        resolveOrgId = user.organizationId
    }

    resolveApprovalDecision(parsed.data.runId, parsed.data.stepId, resolveOrgId, { approved: parsed.data.approved })
    return res.status(200).json({ success: true })
}

function initSseStream(req: Request, res: Response, run: { runId: string; organizationId: string } | null): { send: (event: SdkAgentStreamEvent) => void; sessionId: string | undefined } {
    res.setHeader("Content-Type", "text/event-stream")
    res.setHeader("Cache-Control", "no-cache")
    res.setHeader("Connection", "keep-alive")
    res.flushHeaders()

    const sessionId = req.headers["x-terse-session-id"] as string | undefined

    const send = (event: SdkAgentStreamEvent) => {
        res.write(`data: ${JSON.stringify(event)}\n\n`)
        if (sessionId) emitSessionEvent(sessionId, event)
        if (run && event.type === "action") {
            void appendRunAction(run.runId, event.action, run.organizationId).catch(err => {
                logger.warn("Failed to append run action", { error: err, runId: run.runId })
            })
        }
    }

    return { send, sessionId }
}

type SdkAgentRunnerResult = Awaited<ReturnType<SdkAgentRunner["run"]>>

/** Sends terminal stream events and returns whether the run completed successfully (no tool failures). */
function finishSseStream(res: Response, send: (event: SdkAgentStreamEvent) => void, { loopResult }: SdkAgentRunnerResult, sdkRunner: SdkAgentRunner): boolean {
    let succeeded = false
    if (loopResult.status === "completed") {
        if (loopResult.endedWithToolFailure || sdkRunner.hasToolFailures()) {
            send({ type: "error", message: sdkRunner.getToolFailureSummary() })
        } else {
            succeeded = true
            const finalOutput = SdkAgentRunner.getFinalOutput(loopResult.result)
            if (finalOutput) send({ type: "final_output", finalOutput })
        }
    }
    send({ type: "done" })
    res.end()
    return succeeded
}

function createSdkRunner(params: {
    runId: string
    user: UserSession
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

// LISTEN endpoint (SSE)

const LISTEN_HEARTBEAT_INTERVAL_MS = 25_000

export async function handleSdkListen(req: Request, res: Response) {
    const user = req.session?.user
    if (!user) return res.status(401).json({ success: false, error: "Unauthorized" })

    const parsed = sdkListenQuerySchema.safeParse(req.query)
    if (!parsed.success) return res.status(400).json({ error: "jobName and projectId query params are required" })
    const { jobName, projectId } = parsed.data

    const automation = await db().automations.findFirst({
        where: { organization_id: user.organizationId, project_id: projectId, name: jobName },
        select: { id: true }
    })
    if (!automation) return res.status(404).json({ error: `Job "${jobName}" is not deployed in this project.` })

    const listenerId = crypto.randomUUID()
    const organizationId = user.organizationId

    res.setHeader("Content-Type", "text/event-stream")
    res.setHeader("Cache-Control", "no-cache")
    res.setHeader("Connection", "keep-alive")
    res.flushHeaders()

    const send = (event: SdkListenStreamEvent): void => {
        res.write(`data: ${JSON.stringify(event)}\n\n`)
    }

    send({ type: "listen_started", listenerId, organizationId, projectId, jobName })

    const unsubscribe = onListenForwardedEvent(organizationId, forwarded => {
        if (forwarded.agentName !== jobName) return
        if (forwarded.projectId !== projectId) return
        try {
            send(forwarded)
        } catch (error) {
            logger.warn("Failed to write to /sdk/listen SSE stream", { error, listenerId })
        }
    })

    const heartbeat = setInterval(() => {
        try {
            res.write(`:\n\n`)
        } catch {
            // Connection is gone; cleanup runs in the close handler below.
        }
    }, LISTEN_HEARTBEAT_INTERVAL_MS)

    req.on("close", () => {
        clearInterval(heartbeat)
        unsubscribe()
    })
}

// SESSION events SSE

const SSE_SESSION_CAP = { name: "sse-session", max: 5, keyTtlSeconds: 120, heartbeatIntervalMs: 30_000 }

let sessionCap: ReturnType<typeof RateLimiterClient.prototype.createConnectionCap> | null = null
function getSseCap() {
    if (!sessionCap) sessionCap = RateLimiterClient.getInstance().createConnectionCap(SSE_SESSION_CAP)
    return sessionCap
}

export async function handleSessionEvents(req: Request, res: Response) {
    const user = req.session?.user
    if (!user) return res.status(401).json({ success: false, error: "Unauthorized" })

    const slot = await getSseCap().tryAcquire(user.id)
    if (!slot) {
        res.setHeader("Retry-After", "30")
        return res.status(429).json({ error: "Too many concurrent SSE connections" })
    }

    const sessionId = crypto.randomUUID()

    res.setHeader("Content-Type", "text/event-stream")
    res.setHeader("Cache-Control", "no-cache")
    res.setHeader("Connection", "keep-alive")
    res.flushHeaders()

    let closed = false
    const safeWrite = (line: string): boolean => {
        if (closed) return false
        try {
            return res.write(line)
        } catch (error) {
            logger.warn("[sdkSession] write failed; closing SSE stream", { error, sessionId, userId: user.id })
            teardown()
            return false
        }
    }

    const heartbeat = setInterval(() => {
        safeWrite(`: keepalive\n\n`)
        void slot.refresh().catch(error => logger.warn("[sdkSession] slot.refresh failed", { error, sessionId, userId: user.id }))
    }, SSE_SESSION_CAP.heartbeatIntervalMs)

    const unsubscribe = onSessionEvent(sessionId, event => {
        safeWrite(`data: ${JSON.stringify(event)}\n\n`)
    })

    const teardown = () => {
        if (closed) return
        closed = true
        clearInterval(heartbeat)
        unsubscribe()
        void slot.release().catch(error => logger.warn("[sdkSession] slot.release failed", { error, sessionId, userId: user.id }))
        try {
            res.end()
        } catch {
            // already torn down by the underlying socket; nothing to do
        }
    }

    req.on("close", teardown)
    req.on("error", teardown)
    req.on("aborted", teardown)
    res.on("error", teardown)

    safeWrite(`data: ${JSON.stringify({ type: "session_started", sessionId })}\n\n`)
}
