import { Agent } from "@openai/agents"
import { AgentInputItem } from "@openai/agents-core"
import { z } from "zod"

import { settings } from "../../config/settings"
import logger from "../../logger"
import { db } from "../../prismaClient"
import { IntegrationType } from "../../shared/Integrations"
import { ToolCall } from "../../shared/ModelEvents"
import { User } from "../../shared/types"
import { RunHistoryChatMemorySession, identityHistoryCallback } from "../CustomMemorySession"
import { convertAgentInputItemsToModelEvents } from "../agentInputItemsToModelEvents"
import { AgentType, builderProviderDataModelSettings, runnerFactory } from "../runner"

const ApprovalSummaryClassification = z.object({
    approvalSummary: z.string()
})

type ApprovalSummaryClassificationType = z.infer<typeof ApprovalSummaryClassification>

export async function generateApprovalSummary(runId: string, user: User, agentId: string, stepId: string): Promise<ApprovalSummaryClassificationType> {
    const prisma = db()

    // Fetch run history record to get trigger information
    const runRecord = await prisma.run_history_records.findUnique({
        where: { id: runId },
        select: {
            event: true,
            trigger_integration: true,
            trigger_source: true,
            trigger_title: true,
            trigger_subheader: true,
            trigger_url: true
        }
    })

    if (!runRecord) {
        logger.error(`[generateApprovalSummary] Run record not found for runId: ${runId}`)
        return { approvalSummary: "Unable to generate summary: run record not found" }
    }

    // Build ToolCall context from raw events so summaries do not depend on run_history_chat_events.
    const rawEvents = await prisma.run_history_raw_events.findMany({
        where: {
            run_history_record_id: runId
        },
        orderBy: [{ sequence_order: "asc" }, { created_at: "asc" }],
        select: {
            raw_event_json: true
        }
    })

    const rawItems = rawEvents.map(event => event.raw_event_json as AgentInputItem)
    const modelEvents = convertAgentInputItemsToModelEvents(rawItems)

    let toolCallEvent: ToolCall | null = null
    for (const modelEvent of modelEvents) {
        if (modelEvent.type === "ToolCall" && modelEvent.step_id === stepId) {
            toolCallEvent = modelEvent
            break
        }
    }

    if (!toolCallEvent) {
        toolCallEvent = findToolCallFromRawFunctionCallItems(rawItems, stepId)
    }

    // Build trigger description
    const triggerDescription = buildTriggerDescription(runRecord)

    // Construct user prompt based on whether we found a ToolCall event or need to fallback to actions
    let userPrompt: string

    if (!toolCallEvent) {
        logger.warn(`[generateApprovalSummary] ToolCall event not found for stepId: ${stepId} in runId: ${runId}`)
        // Fallback: try to get action details from run_history_actions
        const runActions = await prisma.run_history_actions.findMany({
            where: {
                run_history_record_id: runId,
                step_id: stepId
            }
        })

        if (runActions.length === 0) {
            return { approvalSummary: "Unable to generate summary: tool call not found" }
        }

        const action = runActions[0]
        userPrompt = `Context (do NOT mention this context in the output; it is for grounding only):
${triggerDescription}

Requested action to summarize (focus only on what will be done):
- Action: ${action.action}
- Integration: ${action.integration}
- Target: ${action.target}
- Details: ${action.details}

Return the single-sentence "I'm going to ..." approvalSummary.`
    } else {
        // Format JSON parameters for readability
        let formattedParameters = toolCallEvent.parameters
        try {
            const parsedParams = JSON.parse(toolCallEvent.parameters)
            formattedParameters = JSON.stringify(parsedParams, null, 2)
        } catch {
            // If parameters aren't valid JSON, use them as-is
            formattedParameters = toolCallEvent.parameters
        }

        // Construct user prompt with tool call details
        userPrompt = `Context (do NOT mention this context in the output; it is for grounding only):
${triggerDescription}

Tool call to summarize (focus only on what will be done):
- Tool summary: ${toolCallEvent.summary}
- Integration: ${toolCallEvent.integration}
- Parameters:
${formattedParameters}

Return the single-sentence "I'm going to ..." approvalSummary.`
    }

    const session = new RunHistoryChatMemorySession({
        sessionId: runId,
        skipSave: true,
        filterIncompleteToolCalls: true
    })

    const runConfig = {
        agentId: agentId,
        agentType: AgentType.APPROVAL_SUMMARY,
        runId: runId,
        user: user,
        env: settings.nodeEnv
    }

    const runner = runnerFactory(runConfig)
    const approvalSummaryAgent = new Agent({
        name: "Approval Summary Agent",
        instructions: `You write the short "Action" line shown in a Slack approval notification.
    
    CRITICAL OUTPUT REQUIREMENTS:
    - Output exactly ONE sentence.
    - Start the sentence with: "I'm going to ..."
    - Describe ONLY the action that will be taken (create/update/etc.) and the target (page/ticket/task/title) so the human understands what they're approving.
    - Do NOT mention the triggering event, source channel, workspace, or that you "reviewed" anything.
    - Do NOT narrate process (no "I reviewed...", "After reviewing...", "There was a message_received...").
    - Do NOT include low-signal field dumps (due date, status, priority, ids, etc.) unless absolutely necessary to identify the target.
    - Keep it tight: aim for <= 25 words when possible.
    
    Examples:
    - Good: "I'm going to update the Notion My To-Do List with a task titled \"Read product requirements doc for data accuracy service\"."
    - Good: "I'm going to update the Confluence \"Data Accuracy\" page with the latest API rate-limit details."
    - Bad: "There was a message_received event from Slack in all-terse-inc... I reviewed..."
    
    IMPORTANT: Return ONLY a valid JSON object with this exact format:
    {"approvalSummary": "your single-sentence summary here"}
    
    Do not include any markdown formatting, code blocks, or explanations. Only return the JSON object.`,
        model: "gpt-5-nano",
        outputType: ApprovalSummaryClassification,
        modelSettings: builderProviderDataModelSettings(runConfig)
    })
    const result = await runner.run(approvalSummaryAgent, [{ role: "user", content: userPrompt }], {
        session,
        sessionInputCallback: identityHistoryCallback
    })

    return result.finalOutput ?? { approvalSummary: "" }
}

function findToolCallFromRawFunctionCallItems(items: AgentInputItem[], stepId: string): ToolCall | null {
    for (const item of items) {
        if (!item || typeof item !== "object") continue
        if (!("type" in item) || item.type !== "function_call") continue

        const maybeCallId = getCallId(item)
        if (!maybeCallId || maybeCallId !== stepId) continue

        const summary = typeof (item as { name?: unknown }).name === "string" ? (item as { name: string }).name || "unknown" : "unknown"
        const argumentsValue = (item as { arguments?: unknown }).arguments
        const parameters = typeof argumentsValue === "string" ? argumentsValue : "{}"

        return {
            summary,
            step_id: maybeCallId,
            parameters,
            integration: IntegrationType.TERSE
        }
    }

    return null
}

function getCallId(item: AgentInputItem): string | null {
    const direct = (item as { callId?: unknown }).callId
    if (typeof direct === "string" && direct.trim().length > 0) {
        return direct
    }

    const snakeCase = (item as { call_id?: unknown }).call_id
    if (typeof snakeCase === "string" && snakeCase.trim().length > 0) {
        return snakeCase
    }

    return null
}

function buildTriggerDescription(runRecord: {
    event: string
    trigger_integration: string
    trigger_source: string
    trigger_title: string | null
    trigger_subheader: string | null
    trigger_url: string | null
}): string {
    const parts: string[] = []

    parts.push(`Event: ${runRecord.event}`)
    parts.push(`Integration: ${runRecord.trigger_integration}`)
    parts.push(`Source: ${runRecord.trigger_source}`)

    if (runRecord.trigger_title) {
        parts.push(`Title: ${runRecord.trigger_title}`)
    }

    if (runRecord.trigger_subheader) {
        parts.push(`Subheader: ${runRecord.trigger_subheader}`)
    }

    if (runRecord.trigger_url) {
        parts.push(`URL: ${runRecord.trigger_url}`)
    }

    return parts.join("\n")
}
