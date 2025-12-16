import { Agent } from "@openai/agents";
import { z } from "zod";
import { identityHistoryCallback, RunHistoryChatMemorySession } from "../CustomMemorySession";
import { runnerFactory } from "../runner";
import { settings } from "../../config/settings";
import { db } from "../../prismaClient";
import { ModelEvent, ToolCall } from "../../shared/ModelEvents";
import logger from "../../logger";


const ApprovalSummaryClassification = z.object({
    approvalSummary: z.string()
});

type ApprovalSummaryClassificationType = z.infer<typeof ApprovalSummaryClassification>;

// --- Agent ---

const approvalSummaryAgent = new Agent({
    name: "Approval Summary Agent",
    instructions: `You are creating a summary for a Slack notification that explains what an AI agent is about to do and why.

Your summary should tell the story of:
1. What event/trigger came in (e.g., "A new email arrived", "A Slack message was posted", "A Notion page was updated")
2. What the agent reviewed (briefly)
3. What action it will take

### Guidelines:
- Write in a casual, conversational, high-level tone (as if explaining to a colleague)
- **CRITICAL: Maximum 2 sentences total. Be extremely concise and direct.**
- Start with the event: "There was [X event] from [source]"
- Briefly mention what was reviewed: "I reviewed [X and Y], and am going to..."
- Describe the action: "I'm going to [create/update/etc.] [target]"
- **NEVER list out field details** like due dates, status, priority, category, etc. unless they are truly unusual or noteworthy
- Remove unnecessary phrases like "that came in", "I determined this should be captured as a task", "After reviewing... I determined"
- Use direct language: "I reviewed X and Y, and am going to..." instead of "After reviewing X and Y, I determined this should be... and I'm going to..."
- Keep it high level - avoid technical details like function names or API specifics
- Focus on the "what", not the "how" or unnecessary details
- Maximum length: 120 tokens. If your summary exceeds this, make it shorter.

### Examples:
- Good: "There was a new email from john@example.com about a bug report. I reviewed Linear tickets and am going to update the matching issue with the email details."

- Good: "A Slack message was posted in #support asking about API rate limits. I checked Notion docs and am going to update the relevant page with the latest information."

- Good: "There was a new Notion database row in our 'Customer Feedback' database. I reviewed similar tickets and am going to create a Linear ticket with the feedback details."

- Good: "There was a Slack message in all-terse-inc from Olivier Simard-Morissette. I reviewed Slack and Notion, and am going to update a Notion to-do entry titled 'Review product requirements doc for the AI evals service'."

- Bad: "There was a Slack message in all-terse-inc from Olivier Simard-Morissette that came in. After reviewing the Slack context and the Notion To-Do List, I determined this should be captured as a task and I'm going to update a Notion to-do entry titled 'Review product requirements doc for the AI evals service' with due date 2025-12-22, status Not started, priority Medium, and category Work." (Too verbose, lists unnecessary fields, uses wordy phrases)

IMPORTANT: Return ONLY a valid JSON object with this exact format:
{"approvalSummary": "your approval summary here"}

Do not include any markdown formatting, code blocks, or explanations. Only return the JSON object.`,
    model: "gpt-5-nano",
    outputType: ApprovalSummaryClassification,
});


export async function generateApprovalSummary(
    runId: string,
    userId: string,
    channelId: string,
    stepId: string
): Promise<ApprovalSummaryClassificationType> {
    const prisma = db();

    // Fetch run history record to get trigger information
    const runRecord = await prisma.run_history_records.findUnique({
        where: { id: runId },
        select: {
            event: true,
            trigger_integration: true,
            trigger_source: true,
            trigger_title: true,
            trigger_subheader: true,
            trigger_url: true,
        },
    });

    if (!runRecord) {
        logger.error(`[generateApprovalSummary] Run record not found for runId: ${runId}`);
        return { approvalSummary: 'Unable to generate summary: run record not found' };
    }

    // Fetch all chat events for the run to find the ToolCall event
    const chatEvents = await prisma.run_history_chat_events.findMany({
        where: {
            run_history_record_id: runId,
        },
        orderBy: [
            { timestamp: "asc" },
            { id: "asc" },
        ],
    });

    // Find the ToolCall event matching the stepId
    let toolCallEvent: ToolCall | null = null;
    for (const chatEvent of chatEvents) {
        const modelEvent = chatEvent.event_json as ModelEvent;
        if (modelEvent.type === "ToolCall" && modelEvent.step_id === stepId) {
            toolCallEvent = modelEvent;
            break;
        }
    }

    // Build trigger description
    const triggerDescription = buildTriggerDescription(runRecord);

    // Construct user prompt based on whether we found a ToolCall event or need to fallback to actions
    let userPrompt: string;

    if (!toolCallEvent) {
        logger.warn(`[generateApprovalSummary] ToolCall event not found for stepId: ${stepId} in runId: ${runId}`);
        // Fallback: try to get action details from run_history_actions
        const runActions = await prisma.run_history_actions.findMany({
            where: {
                run_history_record_id: runId,
                step_id: stepId,
            },
        });

        if (runActions.length === 0) {
            return { approvalSummary: 'Unable to generate summary: tool call not found' };
        }

        const action = runActions[0];
        userPrompt = `**Trigger Event:**
${triggerDescription}

**Action Being Requested:**
Action: ${action.action}
Integration: ${action.integration}
Target: ${action.target}
Details: ${action.details}

Use the conversation history available in the session to understand the context and reasoning that led to this action. Generate a human-readable summary explaining what happened and what action will be taken.`;
    } else {
        // Format JSON parameters for readability
        let formattedParameters = toolCallEvent.parameters;
        try {
            const parsedParams = JSON.parse(toolCallEvent.parameters);
            formattedParameters = JSON.stringify(parsedParams, null, 2);
        } catch {
            // If parameters aren't valid JSON, use them as-is
            formattedParameters = toolCallEvent.parameters;
        }

        // Construct user prompt with tool call details
        userPrompt = `**Trigger Event:**
${triggerDescription}

**Tool Call Being Requested:**
Tool: ${toolCallEvent.summary}
Integration: ${toolCallEvent.integration}
Parameters:
${formattedParameters}

Use the conversation history available in the session to understand the context and reasoning that led to this tool call. Generate a human-readable summary explaining what happened and what action will be taken.`;
    }

    const session = new RunHistoryChatMemorySession({
        sessionId: runId,
        skipSave: true,
        filterIncompleteToolCalls: true
    });

    const runner = runnerFactory({
        runId: runId,
        userId: userId,
        channelId: channelId,
        env: settings.nodeEnv,
    });
    const result = await runner.run(approvalSummaryAgent, [{ role: 'user', content: userPrompt }], {
        session,
        sessionInputCallback: identityHistoryCallback,
    });

    return result.finalOutput ?? { approvalSummary: '' };
}

function buildTriggerDescription(runRecord: {
    event: string;
    trigger_integration: string;
    trigger_source: string;
    trigger_title: string | null;
    trigger_subheader: string | null;
    trigger_url: string | null;
}): string {
    const parts: string[] = [];

    parts.push(`Event: ${runRecord.event}`);
    parts.push(`Integration: ${runRecord.trigger_integration}`);
    parts.push(`Source: ${runRecord.trigger_source}`);

    if (runRecord.trigger_title) {
        parts.push(`Title: ${runRecord.trigger_title}`);
    }

    if (runRecord.trigger_subheader) {
        parts.push(`Subheader: ${runRecord.trigger_subheader}`);
    }

    if (runRecord.trigger_url) {
        parts.push(`URL: ${runRecord.trigger_url}`);
    }

    return parts.join('\n');
}