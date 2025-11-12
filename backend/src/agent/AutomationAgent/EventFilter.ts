import { Agent, AgentInputItem, run } from '@openai/agents';
import { InputEvent } from "../../Updater/InputEvents";
import { AutomationPrompt } from "../../types/prisma";
import { Output, ToolboxEntry } from "../../Updater/Outputs/Output";
import { Session } from "../../server";
import { z } from "zod";

export interface EventFilterResult {
    isRelevant: boolean;
    reason: string;
    confidence: number; // 0-1 scale
}

const filterOutputSchema = z.object({
    isRelevant: z.boolean(),
    reason: z.string(),
    confidence: z.number(),
});

/**
 * Filters a single event to determine if it's relevant to the automation based on user instructions
 */
export async function filterEvent<T extends Session>(
    event: InputEvent,
    automationPrompt: AutomationPrompt,
    output: Output<T>,
    session: T
): Promise<EventFilterResult> {
    try {
        const readOnlyEntries = output.toolbox.filter(entry => entry.isReadOnly);
        const readOnlyTools = readOnlyEntries.map(entry => entry.tool);

        const agent = new Agent<T, typeof filterOutputSchema>({
            name: 'Automation Event Filter',
            instructions: buildFilterSystemPrompt(readOnlyEntries),
            model: 'gpt-4o-mini',
            tools: readOnlyTools,
            outputType: filterOutputSchema,
        });

        const history: AgentInputItem[] = [
            {
                role: 'user',
                content: [
                    {
                        type: 'input_text',
                        text: buildFilterUserPrompt(
                            automationPrompt.content || 'No specific instructions provided',
                            event.formatForAutomationAgent()
                        )
                    }
                ]
            }
        ];

        const result = await run(agent, history, {
            context: session,
        });

        if (result.interruptions && result.interruptions.length > 0) {
            throw new Error('Filter agent requested tool approval, which is not supported for event filtering.');
        }

        const parsed = result.finalOutput ?? null;
        if (!parsed) {
            throw new Error('No final output from filter agent');
        }

        // Validate the response structure
        if (typeof parsed.isRelevant !== 'boolean' ||
            typeof parsed.reason !== 'string' ||
            typeof parsed.confidence !== 'number') {
            throw new Error('Invalid response structure from OpenAI');
        }

        // Ensure confidence is between 0 and 1
        parsed.confidence = Math.max(0, Math.min(1, parsed.confidence));

        console.log(`Event filter result for ${event.integrationType}:`, parsed);
        return parsed;

    } catch (error) {
        console.error('Error filtering event:', error);
        // In case of error, default to allowing the event through with low confidence
        return {
            isRelevant: true,
            reason: `Error during filtering: ${error instanceof Error ? error.message : 'Unknown error'}. Defaulting to relevant.`,
            confidence: 0.1
        };
    }
}

function buildFilterSystemPrompt(tools: ToolboxEntry[]): string {
    const toolNames = tools
        .map(entry => entry.tool.name || 'unnamed_tool')
        .join(', ') || 'None';

    return `You are an event relevance analyzer. Your job is to determine if an incoming event is relevant to a user's automation instructions.

You are responsible for protecting the main Updater agent from spam and noise. Only pass through events that clearly match the user's intent.

You have access to the following tools: ${toolNames}.
- Use tools only when you need additional context (e.g., to inspect the current state of the target document).
- Never modify data; tools are for read-only context gathering during filtering.

Guidelines:
- Be strict but not overly restrictive.
- Consider both the event content and the user's automation instructions.
- If unsure, choose the lower-confidence option.`;
}

function buildFilterUserPrompt(userInstructions: string, eventContent: string): string {
    return `User's Automation Instructions:
${userInstructions}

---

Incoming Event:
${eventContent}

---

Determine relevance. Use tools if you need additional context. Output should match the required schema (isRelevant, reason, confidence).`;
}