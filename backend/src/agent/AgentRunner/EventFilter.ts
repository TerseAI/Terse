import { Agent, AgentInputItem } from "@openai/agents"
import { z } from "zod"

import { settings } from "../../config/settings"
import { InputEvent } from "../../integrations/abstract/InputEvent"
import logger from "../../logger"
import { getRealtimeSocket } from "../../realtimeSocket"
import { IntegrationType } from "../../shared/Integrations"
import type { RunHistoryModelEvent, RunHistoryModelSocketEvent, RunHistoryStreamingParams } from "../../shared/RunHistoryTypes"
import { SocketEvents, SocketRooms } from "../../shared/SocketEvents"
import { AgentPrompt } from "../../types/prisma"
import { Session } from "../../types/session"
import { randomString } from "../../utility/strings"
import { runnerFactory } from "../runner"
import { transformAgentStreamToModelEvents } from "../streaming"

import { storeChatEvent } from "./runHistory"

export interface EventFilterResult {
    isRelevant: boolean
    reason: string
    confidence: number // 0-1 scale
}

const filterOutputSchema = z.object({
    isRelevant: z.boolean(),
    reason: z.string(),
    confidence: z.number()
})

function buildFilterSystemPrompt(currentTimeUtc: string): string {
    return `
You are EVENT_FILTER, a strict but fair event relevance analyzer.

Your PURPOSE is to decide whether a single incoming event should be forwarded to the main automation agent for processing.

=====================
0. CURRENT TIME
=====================
The current time in UTC is: ${currentTimeUtc}

Use this information to understand temporal context when evaluating event relevance.

=====================
1. CAPABILITIES & LIMITS
=====================
- You DO NOT have access to tools.
- You CANNOT inspect the current state of any document, CRM, ticket, or wiki.
- You MUST base your decision ONLY on:
  - The user's CHANNEL INSTRUCTIONS.
  - The content of the INCOMING EVENT.

If a decision would reasonably require knowing the current document state, you MUST ASSUME THE EVENT IS RELEVANT and let it pass.

=====================
2. DECISION CRITERIA
=====================
Consider an event RELEVANT if:
- It clearly matches the user's channel instructions or described use case, OR
- It plausibly may change or affect the target output(s), OR
- Determining relevance would require inspecting the current document state.

Consider an event NOT RELEVANT if:
- It is clearly spam, marketing noise, or unrelated chatter.
- It obviously does not match the user's instructions or domain.
- It contains only trivial activity with no meaningful impact on the automation's outputs or tasks.

Be STRICT but not overzealous:
- When in genuine doubt due to missing document state, choose isRelevant: true with a LOWER confidence.
- When you are confident that the event is noise, choose isRelevant: false with an appropriate confidence.

=====================
3. OUTPUT CONTRACT
=====================
You MUST return a JSON object that matches this schema EXACTLY:

{
  "isRelevant": boolean,
  "reason": string,
  "confidence": number
}

- "isRelevant": true if the event should be forwarded to the updater agent, false otherwise.
- "reason": a short, clear explanation of why you made this decision.
- "confidence": a number between 0 and 1 representing how confident you are in the decision.

You may provide additional context and analysis in your text response, but you MUST include the structured JSON output.
`
}

function buildFilterAgent(): Agent<Session, typeof filterOutputSchema> {
    const currentTimeUtc = new Date().toISOString()
    const systemPrompt = buildFilterSystemPrompt(currentTimeUtc)
    return new Agent<Session, typeof filterOutputSchema>({
        name: "Agent Event Filter",
        instructions: systemPrompt,
        model: "gpt-4o-mini",
        modelSettings: {
            temperature: 0.3,
            maxTokens: 200
        },
        tools: [], // No tools - filter should not make tool calls
        outputType: filterOutputSchema
    })
}

function buildFilterHistory(agentPrompt: AgentPrompt, event: InputEvent): AgentInputItem[] {
    return [
        {
            role: "user",
            content: [
                {
                    type: "input_text",
                    text: buildFilterUserPrompt(agentPrompt.content || "No specific instructions provided", event.formatForAgentRunner())
                }
            ]
        }
    ]
}

/**
 * Filters a single event to determine if it's relevant to the agent based on user instructions
 * Returns both the filter result and an async generator for streaming events
 *
 * If isStreaming is true and trackingParams are provided, automatically handles storing events and emitting them via Socket.IO
 */
export async function filterEvent(event: InputEvent, agentPrompt: AgentPrompt, isStreaming: boolean, trackingParams?: RunHistoryStreamingParams): Promise<{ result: EventFilterResult }> {
    if (event.integrationType === IntegrationType.CRON_JOB) {
        return {
            result: {
                isRelevant: true,
                reason: "Cron job event is relevant",
                confidence: 1
            }
        }
    }

    logger.info(`#WTF filtering event ${event.integrationType}`, { event })
    logger.info(`#WTF formatted event`, { formattedEvent: event.formatForAgentRunner() })

    const agent = buildFilterAgent()
    const history = buildFilterHistory(agentPrompt, event)
    const runner = runnerFactory({
        agentId: trackingParams?.agentId || "",
        runId: trackingParams?.runId || "",
        userId: trackingParams?.userId || "",
        env: settings.nodeEnv
    })

    if (isStreaming && trackingParams?.runId && trackingParams?.organizationId && trackingParams?.agentId) {
        try {
            const result = await runner.run(agent, history, {
                stream: true,
                context: undefined as any // Filter agent doesn't need session context
            })

            if (result.interruptions && result.interruptions.length > 0) {
                throw new Error("Filter agent requested tool approval, which is not supported for event filtering.")
            }

            const io = getRealtimeSocket()
            const orgRoom = SocketRooms.organization(trackingParams.organizationId)

            try {
                for await (const modelEvent of transformAgentStreamToModelEvents(result)) {
                    if (modelEvent.type === "TextDelta") {
                        continue
                    }
                    const eventId = await storeChatEvent(trackingParams.runId, modelEvent)
                    if (io) {
                        const runHistoryModelEvent: RunHistoryModelEvent = {
                            ...modelEvent,
                            id: eventId,
                            timestamp: Date.now()
                        }
                        const payload: RunHistoryModelSocketEvent = {
                            runId: trackingParams.runId,
                            agentId: trackingParams.agentId,
                            runHistoryModelEvent
                        }
                        io.to(orgRoom).emit(SocketEvents.AGENT_CHAT_EVENT, payload)
                    }
                }
            } catch (error) {
                logger.error("Error streaming filter events", {
                    error,
                    runId: trackingParams.runId,
                    agentId: trackingParams.agentId
                })
            }

            const parsed = result.finalOutput ?? null
            if (!parsed) {
                throw new Error("No final output from filter agent")
            }
            parsed.confidence = Math.max(0, Math.min(1, parsed.confidence))

            const filterResultEvent = {
                type: "FilterResult" as const,
                isRelevant: parsed.isRelevant,
                reason: parsed.reason,
                confidence: parsed.confidence,
                step_id: randomString(15)
            }
            const filterEventId = await storeChatEvent(trackingParams.runId, filterResultEvent)
            if (io) {
                const runHistoryModelEvent: RunHistoryModelEvent = {
                    ...filterResultEvent,
                    id: filterEventId,
                    timestamp: Date.now()
                }
                const payload: RunHistoryModelSocketEvent = {
                    runId: trackingParams.runId,
                    agentId: trackingParams.agentId,
                    runHistoryModelEvent
                }
                io.to(orgRoom).emit(SocketEvents.AGENT_CHAT_EVENT, payload)
            }
            logger.info(`Event filter result for ${event.integrationType}:`, { parsed })
            return { result: parsed }
        } catch (error) {
            throw error
        }
    } else {
        const result = await runner.run(agent, history, {
            context: undefined as any // Filter agent doesn't need session context
        })
        const parsed = result.finalOutput ?? null
        if (!parsed) {
            throw new Error("No final output from filter agent")
        }
        parsed.confidence = Math.max(0, Math.min(1, parsed.confidence))
        logger.info(`Event filter result for ${event.integrationType}:`, { parsed })
        return { result: parsed }
    }
}

function buildFilterUserPrompt(userInstructions: string, eventContent: string): string {
    return `
<USER_CHANNEL_INSTRUCTIONS>
${userInstructions}
</USER_CHANNEL_INSTRUCTIONS>

<INCOMING_EVENT>
${eventContent}
</INCOMING_EVENT>

<ROLE>
You are an event relevance analyzer. Your job is to determine if an incoming event is relevant to a user's automation instructions.

You are responsible for protecting the main Updater agent from spam and noise. 

The way the main system works is we listen for events from a set of inputs, then send them to a model with a custom user prompt. Then we have an output that we update based on the event.
</ROLE>

<TASK>
Decide if the INCOMING_EVENT is relevant to the USER_CHANNEL_INSTRUCTIONS for routing to the main automation agent.

You will only be given:
1. An event (email, GitHub commit, Slack message, etc.)
2. User instructions describing what they want to automate

Your task is to decide if this event should trigger the automation based on whether it matches the user's intent.

Guidelines:
- Be strict but not overly restrictive - only mark as relevant if the event clearly relates to the user's instructions
- Consider the context and intent of both the event and the instructions
- If the event is completely unrelated or spam-like, mark it as not relevant with high confidence
- If unsure, err on the side of caution with lower confidence
</TASK>

<OUTPUT_REQUIREMENTS>
Return ONLY a JSON object with the fields:
- "isRelevant": boolean
- "reason": string
- "confidence": number between 0 and 1
</OUTPUT_REQUIREMENTS>
`.trim()
}
