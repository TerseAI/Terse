import { Request, Response } from "express"
import crypto from "node:crypto"
import { BillingError, CreditGateDeniedError, SdkListenStreamEvent, sdkListenQuerySchema } from "terse-types"
import { SkillConfigData } from "terse-types/Configs"
import {
    SdkAgentRunResponseBody,
    SdkAgentStreamEvent,
    SdkInputRequestRegisterResponse,
    SdkJobSuspendResponseBody,
    UserSession,
    sdkAgentRunRequestBodySchema,
    sdkApprovalDecisionRequestBodySchema,
    sdkInputRequestRegisterBodySchema,
    sdkJobSuspendRequestBodySchema
} from "terse-types/types"
import { z } from "zod"

import logger from "../../../common/logger"
import { SandboxSuspendTelemetry } from "../../../common/sandboxRuntimeTelemetry"
import { extractErrorMessage } from "../../../common/strings"
import { db } from "../../../loaders/prisma"
import { finalizeRunFailure } from "../../../loaders/socket"
import { SdkAgentRunner } from "../../../modules/agents/AgentRunner/SdkAgentRunner"
import { type RunSuspensionDetails, appendRunAction, claimSuspendedRun, markRunFailed, markRunSuspended, upsertSdkSkills } from "../../../modules/agents/AgentRunner/runHistory"
import { onListenForwardedEvent } from "../../../modules/agents/ListenBus"
import { emitSessionEvent, onSessionEvent } from "../../../modules/agents/SessionEventBus"
import { classifyAgentError } from "../../../modules/agents/agentErrorUtils"
import { CancelReason } from "../../../modules/agents/cancellation/RunCancellationTaskQueue"
import { markRunCancelledAndInvalidate } from "../../../modules/agents/cancellation/runCancellationEffects"
import { RateLimiterClient } from "../../../rateLimit/RateLimiterClient"
import { type BillingService, billingServiceProxyForOrganization } from "../../../services/BillingService"
import { readStashedInputResponse, registerInputRequest } from "../../../services/InputRequestService"
import { snapshotSandboxForSuspend } from "../../../services/resolveRunStatus"
import { enqueueRunExecution } from "../../../tasks/queues/runExecutionQueue"
import { resolveApprovalDecision, waitForApprovalDecision } from "../approval-gate/queue"

const sdkAgentRunInputSchema = sdkAgentRunRequestBodySchema.extend({ prompt: z.string().min(1) })

export async function handleSdkAgentRun(req: Request, res: Response) {
    const user = req.session?.user
    if (!user) return res.status(401).json({ success: false, error: "Unauthorized" })

    const parsed = sdkAgentRunInputSchema.safeParse(req.body)
    if (!parsed.success) {
        const response: SdkAgentRunResponseBody = { success: false, error: "Invalid request body", details: parsed.error.issues.map(i => i.message) }
        return res.status(400).json(response)
    }

    const headerRunId = req.headers["x-terse-run-id"] as string | undefined
    if (!headerRunId) return res.status(400).json({ success: false, error: "X-Terse-Run-Id header is required" })
    const runContext = await resolveRunContext(headerRunId, user)
    if (!runContext) return res.status(404).json({ success: false, error: "Run not found" })

    const { runId, agentId, organizationId: orgId, isTest } = runContext
    const isProductionRun = !isTest
    const { data } = parsed
    const { send } = initSseStream(req, res, { runId, organizationId: orgId })

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
                } else {
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

        finishSseStream(res, send, result, sdkRunner)
    } catch (error) {
        if (isProductionRun) {
            await finalizeFailedProductionRun(runId, orgId, user, error)
        } else {
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

type ResolvedRunContext = { runId: string; agentId: string; organizationId: string; isTest: boolean }

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

async function resolveRunContext(headerRunId: string, user: UserSession): Promise<ResolvedRunContext | null> {
    if (!user.organizationId) return null
    const runRecord = await db().run_history_records.findFirst({
        where: { id: headerRunId, automation: { organization_id: user.organizationId } },
        select: { id: true, automation_id: true, is_test: true, automation: { select: { organization_id: true } } }
    })
    if (!runRecord?.automation.organization_id) {
        logger.warn("[sdk/agent-run] Rejecting cross-tenant x-terse-run-id header", { requestedRunId: headerRunId, userId: user.id, organizationId: user.organizationId })
        return null
    }
    return { runId: runRecord.id, agentId: runRecord.automation_id, organizationId: runRecord.automation.organization_id, isTest: runRecord.is_test }
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

    try {
        await resolveApprovalDecision(parsed.data.runId, parsed.data.stepId, resolveOrgId, { approved: parsed.data.approved })
    } catch (error) {
        logger.error("[sdk/approval-decision] Failed to publish approval decision", { error, runId: parsed.data.runId, stepId: parsed.data.stepId })
        return res.status(500).json({ success: false, error: "Failed to deliver approval decision — please retry" })
    }
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

const SSE_SESSION_CAP = { name: "sse-session", max: 100, lockTimeoutMs: 120_000, refreshIntervalMs: 30_000 }
const SSE_HEARTBEAT_INTERVAL_MS = 30_000
const SSE_MAX_STALLED_HEARTBEATS = 4

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
        return res.status(429).json({ error: "Too many concurrent Terse sessions" })
    }

    const sessionId = crypto.randomUUID()

    req.socket.setKeepAlive(true, SSE_HEARTBEAT_INTERVAL_MS)
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

    // A healthy peer drains the response buffer between beats; a buffer that stays
    // unflushed across several beats is a dead connection the socket never reported.
    let stalledHeartbeats = 0
    const heartbeat = setInterval(() => {
        stalledHeartbeats = res.writableLength > 0 ? stalledHeartbeats + 1 : 0
        if (stalledHeartbeats >= SSE_MAX_STALLED_HEARTBEATS) {
            logger.warn("[sdkSession] peer stopped reading; closing SSE stream", { sessionId, userId: user.id })
            teardown()
            return
        }
        safeWrite(`: keepalive\n\n`)
    }, SSE_HEARTBEAT_INTERVAL_MS)

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

export async function handleJobSuspension(req: Request, res: Response) {
    const user = req.session?.user
    if (!user) return res.status(401).json({ success: false, error: "Unauthorized" })

    const parsed = sdkJobSuspendRequestBodySchema.safeParse(req.body)
    if (!parsed.success) {
        return res.status(400).json({ success: false, error: "Invalid request body", details: parsed.error.issues.map(i => i.message) })
    }

    const { runId } = parsed.data
    const suspension = suspensionDetails(parsed.data)
    const delaySeconds = suspension.kind === "timer" ? suspension.delaySeconds : undefined
    const telemetry = new SandboxSuspendTelemetry({
        userId: user.id,
        runId,
        suspensionKind: suspension.kind,
        delaySeconds
    })
    let parked = false
    try {
        const imageId = await telemetry.measure("snapshotSandboxMs", () => snapshotSandboxForSuspend(runId))
        if (!imageId) {
            throw new Error("No live sandbox to snapshot; the run cannot be suspended")
        }
        parked = await telemetry.measure("markRunSuspendedMs", () => markRunSuspended(runId, imageId, suspension))
        if (!parked) {
            const existing = await db().run_history_records.findUnique({ where: { id: runId }, select: { status: true } })
            if (existing?.status !== "suspended") throw new Error("Run is no longer in progress and cannot be suspended")
        } else if (suspension.kind === "timer") {
            await telemetry.measure("enqueueRunResumptionMs", () => enqueueRunResumption(runId, imageId, suspension.delaySeconds))
        }
        await telemetry.capture(true)

        const response: SdkJobSuspendResponseBody = { success: true }
        return res.status(200).json(response)
    } catch (error) {
        logger.error("Failed to suspend job", { error, runId })
        await telemetry.capture(false, error)
        if (parked) await rollbackSuspension(runId)
        return res.status(500).json({ success: false, error: extractErrorMessage(error) })
    }
}

function suspensionDetails(body: z.infer<typeof sdkJobSuspendRequestBodySchema>): RunSuspensionDetails {
    if (!("kind" in body)) return { kind: "timer", delaySeconds: body.delaySeconds }
    if (body.kind === "timer") return { kind: "timer", delaySeconds: body.delaySeconds }
    return { kind: "input", hookToken: body.hookToken }
}

// Suspension parks the run as a delayed pg-boss job; when the delay elapses the worker-side
// dispatcher claims the suspended run and re-executes it from the restored journal snapshot.
async function enqueueRunResumption(runId: string, restoreImageId: string, delaySeconds: number): Promise<void> {
    const run = await db().run_history_records.findUnique({
        where: { id: runId },
        select: { automation: { select: { id: true, organization_id: true, user_id: true, name: true } } }
    })
    if (!run?.automation) {
        throw new Error(`Run not found for resumption: ${runId}`)
    }

    await enqueueRunExecution(
        {
            runId,
            agentId: run.automation.id,
            orgId: run.automation.organization_id,
            userId: run.automation.user_id,
            jobName: run.automation.name,
            kind: "sandbox",
            restoreImageId
        },
        { delaySeconds }
    )
}

// Suspension failed midway: hand the run back to the live sandbox so the dispatcher can
// finalize it normally instead of leaving it parked with no resume job.
async function rollbackSuspension(runId: string): Promise<void> {
    await claimSuspendedRun(runId).catch(error => logger.error("Failed to roll back suspension", { error, runId }))
}

export async function handleInputRequestRegister(req: Request, res: Response) {
    const user = req.session?.user
    if (!user?.organizationId) return res.status(401).json({ success: false, error: "Unauthorized" })

    const parsed = sdkInputRequestRegisterBodySchema.safeParse(req.body)
    if (!parsed.success) {
        return res.status(400).json({ success: false, error: "Invalid request body", details: parsed.error.issues.map(i => i.message) })
    }

    const result = await registerInputRequest(user.organizationId, parsed.data)
    if (!result.ok) {
        const response: SdkInputRequestRegisterResponse = { success: false, error: result.error }
        return res.status(422).json(response)
    }

    const response: SdkInputRequestRegisterResponse = { success: true, delivery: result.delivery }
    return res.status(200).json(response)
}

export async function handleInputResponsePoll(req: Request, res: Response) {
    const user = req.session?.user
    if (!user?.organizationId) return res.status(401).json({ success: false, error: "Unauthorized" })

    const token = req.params.token?.trim()
    if (!token) return res.status(400).json({ success: false, error: "token is required" })

    try {
        const response = await readStashedInputResponse(user.organizationId, token)
        if (!response) return res.status(204).end()
        return res.status(200).json(response)
    } catch (error) {
        logger.error("[sdk/input-request] Failed to read stashed input response", { token, error: extractErrorMessage(error) })
        return res.status(500).json({ success: false, error: "Failed to read input response" })
    }
}
