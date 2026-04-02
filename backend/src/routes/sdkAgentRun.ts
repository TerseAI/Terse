import { RunToolApprovalItem, Tool, ToolInputParameters, ToolOptions, tool } from "@openai/agents"
import { Request, Response } from "express"
import { CONFIG_DETAILS } from "terse-types/Configs"
import { IntegrationType } from "terse-types/Integrations"
import { RunHistoryAction } from "terse-types/RunHistoryTypes"
import { SdkAgentRunRequestBody, SdkAgentRunResponseBody, SdkAgentSkillPayload, SdkAgentStreamEvent, SdkApprovalDecisionRequestBody, User } from "terse-types/types"

import { SessionWithTracking } from "../agent/AgentRunner/AgentRunner"
import { SdkAgentRunner } from "../agent/AgentRunner/SdkAgentRunner"
import { appendRunAction } from "../agent/AgentRunner/runHistory"
import { emitSessionEvent } from "../agent/SessionEventBus"
import logger from "../logger"
import { OutputFactory } from "../outputs/abstract/OutputFactory"
import { createNeedsApprovalFunction, formatError } from "../tools/toolUtils"
import { Session } from "../types/session"
import { extractErrorMessage } from "../utility/strings"

import { validateAndNormalizeSdkAgentRunBody } from "./sdkAgentRunValidation"
import { resolveApprovalDecision, waitForApprovalDecision } from "./sdkApprovalGate"

/**
 * POST /sdk/agent-run
 *
 * Streams the agent run over SSE. If the agent requests tool approval,
 * the stream stays open while we wait for a decision via POST /sdk/approval-decision.
 * On receiving the decision, the agent resumes and continues streaming.
 */
export async function handleSdkAgentRun(req: Request, res: Response) {
    const user = req.session?.user as User | undefined
    if (!user) {
        return res.status(401).json({ success: false, error: "Unauthorized" })
    }

    const body = req.body as SdkAgentRunRequestBody
    const validation = validateAndNormalizeSdkAgentRunBody(body)
    if (!validation.ok) {
        const response: SdkAgentRunResponseBody = {
            success: false,
            error: "Invalid request body",
            details: validation.errors
        }
        return res.status(400).json(response)
    }

    const normalized = validation.normalized
    const { send, sandboxRunId } = initSseStream(req, res)

    try {
        const runId = sandboxRunId ?? `sdk-run-${Date.now()}`
        const sdkRunner = createSdkRunner({
            runId,
            user,
            prompt: normalized.prompt,
            skills: normalized.skills,
            toolApprovals: normalized.toolApprovals,
            send,
            sandboxRunId,
            options: normalized.options
        })

        send({ type: "run_started", runId })

        const eventText = ["", `Integration Type: ${normalized.event.integrationType}`, `Event Content:`, normalized.event.formattedContent, ``, `Debug Log: ${normalized.event.debugLog}`].join("\n")

        let result = await sdkRunner.run(eventText)

        // Approval loop: keep the stream open while awaiting decisions
        while (result.loopResult.status === "awaiting_approval") {
            const interruptions = result.loopResult.interruptions ?? []
            const stepId = (interruptions[0]?.rawItem as any)?.callId as string | undefined
            if (!stepId) {
                send({ type: "error", message: "Approval requested but no stepId found in interruption" })
                break
            }

            const decision = await waitForApprovalDecision(runId, stepId)
            const resumeDecision = decision.approved ? ("approve" as const) : ("reject" as const)
            result = await sdkRunner.resume(resumeDecision, stepId, JSON.stringify(result.loopResult.state), interruptions, decision.rejectionReason)
        }

        finishSseStream(res, send, result, sdkRunner)
    } catch (error) {
        const message = extractErrorMessage(error)
        send({ type: "error", message })
        send({ type: "done" })
        res.end()
    }
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

    const body = req.body as SdkApprovalDecisionRequestBody
    if (!body.runId || !body.stepId || typeof body.approved !== "boolean") {
        return res.status(400).json({ success: false, error: "Missing required fields: runId, stepId, approved" })
    }

    resolveApprovalDecision(body.runId, body.stepId, { approved: body.approved })

    return res.status(200).json({ success: true })
}

// Helpers

function initSseStream(
    req: Request,
    res: Response
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
    const sandboxRunId = req.headers["x-terse-run-id"] as string | undefined

    const send = (event: SdkAgentStreamEvent) => {
        res.write(`data: ${JSON.stringify(event)}\n\n`)
        if (sessionId) emitSessionEvent(sessionId, event)

        if (sandboxRunId && event.type === "action") {
            void appendRunAction(sandboxRunId, event.action as RunHistoryAction).catch(err => {
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
    skills: SdkAgentSkillPayload[]
    toolApprovals: string[]
    send: (event: SdkAgentStreamEvent) => void
    sandboxRunId: string | undefined
    options?: { maxTurns?: number; requireApproval?: boolean }
}): SdkAgentRunner {
    const { tools, toolToIntegrationMap } = buildToolsForSkills(params.skills.map(s => CONFIG_DETAILS[s.configType].integrationType))

    return new SdkAgentRunner({
        runId: params.runId,
        user: params.user,
        prompt: params.prompt,
        skills: params.skills,
        toolApprovals: params.toolApprovals,
        tools,
        toolToIntegrationMap,
        maxTurns: params.options?.maxTurns ?? 50,
        requireApproval: params.options?.requireApproval ?? true,
        send: params.send,
        isProductionRun: !!params.sandboxRunId
    })
}

function buildToolsForSkills(skillIntegrationTypes: IntegrationType[]): {
    tools: Tool<SessionWithTracking<Session>>[]
    toolToIntegrationMap: Map<string, IntegrationType>
} {
    const allowed = new Set<IntegrationType>(skillIntegrationTypes)
    const toolByName = new Map<string, Tool<SessionWithTracking<Session>>>()
    const toolToIntegrationMap = new Map<string, IntegrationType>()

    for (const [, factory] of OutputFactory.OUTPUT_REGISTRY) {
        const output = factory()
        for (const entry of output.toolbox) {
            const toolOptions = {
                ...entry.tool,
                needsApproval: createNeedsApprovalFunction(entry.tool.name ?? ""),
                errorFunction: formatError
            }
            const toolEntry = tool(toolOptions as ToolOptions<ToolInputParameters, SessionWithTracking<Session>>)
            if (!allowed.has(entry.integration)) continue
            if (toolByName.has(toolEntry.name)) continue
            toolByName.set(toolEntry.name, toolEntry)
            toolToIntegrationMap.set(toolEntry.name, entry.integration)
        }
    }

    return {
        tools: Array.from(toolByName.values()),
        toolToIntegrationMap
    }
}
