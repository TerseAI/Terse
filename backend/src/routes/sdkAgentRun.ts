import { Tool } from "@openai/agents"
import { Request, Response } from "express"

import { SessionWithTracking } from "../agent/AgentRunner/AgentRunner"
import { SdkAgentRunner } from "../agent/AgentRunner/SdkAgentRunner"
import { OutputFactory } from "../outputs/abstract/OutputFactory"
import { IntegrationType } from "../shared/Integrations"
import { SdkAgentRunRequestBody, SdkAgentRunResponseBody, SdkAgentStreamEvent, User } from "../shared/types"
import { Session } from "../types/session"

import { validateAndNormalizeSdkAgentRunBody } from "./sdkAgentRunValidation"

/**
 * POST /sdk/agent-run
 *
 * Placeholder route for SDK-driven full agent loop execution.
 * We wire this endpoint first, then implement execution in follow-up chunks.
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

    res.setHeader("Content-Type", "text/event-stream")
    res.setHeader("Cache-Control", "no-cache")
    res.setHeader("Connection", "keep-alive")
    res.flushHeaders()

    const send = (event: SdkAgentStreamEvent) => {
        res.write(`data: ${JSON.stringify(event)}\n\n`)
    }

    try {
        const { tools, toolToIntegrationMap } = buildToolsForSkills(normalized.skills.map(s => s.integrationType))
        const runId = `sdk-run-${Date.now()}`
        const eventText = [`Integration Type: ${normalized.event.integrationType}`, `Event Content:`, normalized.event.formattedContent, ``, `Debug Log: ${normalized.event.debugLog}`].join("\n")
        const sdkRunner = new SdkAgentRunner({
            runId,
            user,
            prompt: normalized.prompt,
            tools,
            toolToIntegrationMap,
            maxTurns: normalized.options.maxTurns,
            requireApproval: normalized.options.requireApproval,
            send
        })
        const { loopResult } = await sdkRunner.run(eventText)

        if (loopResult.status === "awaiting_approval") {
            send({ type: "error", message: "This SDK run is waiting for tool approval, but approval resume is not supported in this route yet." })
            send({ type: "done" })
            return res.end()
        }

        const finalOutput = SdkAgentRunner.getFinalOutput(loopResult.result)
        if (finalOutput) {
            send({ type: "text", text: finalOutput })
        }
        send({ type: "done" })
        return res.end()
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        send({ type: "error", message })
        send({ type: "done" })
        return res.end()
    }
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
            if (!allowed.has(entry.integration)) continue
            if (toolByName.has(entry.tool.name)) continue
            toolByName.set(entry.tool.name, entry.tool as Tool<SessionWithTracking<Session>>)
            toolToIntegrationMap.set(entry.tool.name, entry.integration)
        }
    }

    return {
        tools: Array.from(toolByName.values()),
        toolToIntegrationMap
    }
}
