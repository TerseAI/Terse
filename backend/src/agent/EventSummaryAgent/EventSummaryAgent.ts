import { Agent } from "@openai/agents"
import { z } from "zod"

import { settings } from "../../config/settings"
import { IntegrationType } from "../../shared/Integrations"
import { User } from "../../shared/types"
import { AgentType, builderProviderDataModelSettings, runnerFactory } from "../runner"
import { createUserMessageItem } from "../userMessage"

const EventSummarySchema = z.object({
    summary: z.string()
})

export async function generateEventSummary(integrationType: IntegrationType, eventData: unknown, user: User): Promise<{ summary: string }> {
    const formattedEventData = JSON.stringify(eventData, null, 2)
    const userPrompt = `Summarize this ${integrationType} event:\n\n${formattedEventData}`

    const runConfig = {
        agentId: AgentType.EVENT_SUMMARY,
        agentType: AgentType.EVENT_SUMMARY,
        user: user,
        env: settings.nodeEnv
    }
    const modelSettings = builderProviderDataModelSettings(runConfig)
    const eventSummaryAgent = new Agent({
        name: "Event Summary Agent",
        instructions: `You summarize incoming integration events into a single concise line.
    
    CRITICAL OUTPUT REQUIREMENTS:
    - Output exactly ONE sentence, maximum 150 characters.
    - Describe WHO did WHAT and WHERE (channel/repo/project).
    - Include a brief preview of the content if relevant.
    - Do NOT include technical IDs, timestamps, or metadata.
    - Make it human-readable and scannable.
    
    IMPORTANT: Return ONLY a valid JSON object: {"summary": "..."}`,
        model: "gpt-4o-mini",
        outputType: EventSummarySchema,
        modelSettings: modelSettings
    })

    const runner = runnerFactory(runConfig)

    const result = await runner.run(eventSummaryAgent, [createUserMessageItem(userPrompt)], {
        stream: false
    })

    return (result.finalOutput as { summary: string } | undefined) ?? { summary: `${integrationType} event` }
}
