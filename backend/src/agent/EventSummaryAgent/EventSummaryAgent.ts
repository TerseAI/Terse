import { Agent } from "@openai/agents"
import { z } from "zod"

import { settings } from "../../config/settings"
import { IntegrationType } from "../../shared/Integrations"
import { runnerFactory } from "../runner"

const EventSummarySchema = z.object({
    summary: z.string()
})

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
    outputType: EventSummarySchema
})

export async function generateEventSummary(integrationType: IntegrationType, eventData: unknown): Promise<{ summary: string }> {
    const formattedEventData = JSON.stringify(eventData, null, 2)
    const userPrompt = `Summarize this ${integrationType} event:\n\n${formattedEventData}`

    const runner = runnerFactory({
        runId: "event-summary",
        userId: "system",
        agentId: "event-summary-agent",
        env: settings.nodeEnv
    })

    const result = await runner.run(eventSummaryAgent, [{ role: "user", content: userPrompt }], {
        stream: false
    })

    return (result.finalOutput as { summary: string } | undefined) ?? { summary: `${integrationType} event` }
}
