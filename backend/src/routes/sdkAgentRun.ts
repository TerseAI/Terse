import { Agent, AgentOutputType, Tool } from "@openai/agents"
import { Request, Response } from "express"

import { SessionWithTracking } from "../agent/AgentRunner/AgentRunner"
import { AgentType, runnerFactory } from "../agent/runner"
import { transformAgentStreamToModelEvents } from "../agent/streaming"
import { settings } from "../config/settings"
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

        const runConfig = {
            agentId: "sdk-agent-run",
            agentType: AgentType.AGENT_RUNNER,
            runId: `sdk-run-${Date.now()}`,
            user,
            env: settings.nodeEnv
        }

        const agent = new Agent<SessionWithTracking<Session>, AgentOutputType>({
            name: "Terse SDK Agent",
            model: "gpt-5.2",
            instructions: normalized.prompt,
            tools
        })

        const runner = runnerFactory(runConfig)
        const eventText = [`Integration Type: ${normalized.event.integrationType}`, `Event Content:`, normalized.event.formattedContent, ``, `Debug Log: ${normalized.event.debugLog}`].join("\n")

        const toolContext: SessionWithTracking<Session> = {
            user,
            isUserInitiated: true,
            agent: {
                requireApproval: normalized.options.requireApproval,
                toolApprovals: []
            },
            runId: `sdk-run-${Date.now()}`,
            agentId: "sdk-agent-run"
        }

        const result = await runner.run(
            agent,
            [
                {
                    role: "user",
                    content: eventText
                }
            ],
            {
                stream: true,
                context: toolContext,
                maxTurns: normalized.options.maxTurns
            }
        )

        const modelEvents = transformAgentStreamToModelEvents(result, {
            toolToIntegrationMap,
            onToolCallComplete: async (_callId, _toolName, actions) => {
                for (const action of actions ?? []) {
                    send({ type: "action", action })
                }
                return []
            }
        })

        for await (const event of modelEvents) {
            if (event.type === "TextDelta" && event.delta) {
                send({ type: "text", text: event.delta })
                continue
            }
            if (event.type === "ToolCall") {
                send({ type: "tool_call_params", toolCallParams: event.parameters })
                send({ type: "tool_call_started", toolCallStarted: event.summary })
                continue
            }
            if (event.type === "ToolCallComplete") {
                send({
                    type: "tool_call_completed",
                    toolCallCompleted: JSON.stringify({
                        tool: event.tool_name,
                        status: event.status,
                        result: event.result
                    })
                })
                continue
            }
        }

        if (typeof result.finalOutput === "string" && result.finalOutput.trim()) {
            send({ type: "text", text: result.finalOutput })
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
