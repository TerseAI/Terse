import { Agent, AgentInputItem, run } from '@openai/agents';
import { InputEvent } from "../../integrations/abstract/InputEvent";
import { ChannelPrompt } from "../../types/prisma";
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
 * Filters a single event to determine if it's relevant to the channel based on user instructions
 */
export async function filterEvent<T extends Session>(
    event: InputEvent,
    channelPrompt: ChannelPrompt,
    session: T
): Promise<EventFilterResult> {
    try {
        const agent = new Agent<T, typeof filterOutputSchema>({
            name: 'Channel Event Filter',
            instructions: buildFilterSystemPrompt(),
            model: 'gpt-4o-mini',
            tools: [], // No tools - filter should not make tool calls
            outputType: filterOutputSchema,
        });

        const history: AgentInputItem[] = [
            {
                role: 'user',
                content: [
                    {
                        type: 'input_text',
                        text: buildFilterUserPrompt(
                            channelPrompt.content || 'No specific instructions provided',
                            event.formatForChannelAgent()
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
        // Re-throw error to be handled by the caller (EventProcessor)
        // This allows proper error tracking in run history
        throw error;
    }
}

function buildFilterSystemPrompt(): string {
    return `You are an event relevance analyzer. Your job is to determine if an incoming event is relevant to a user's channel instructions.

You are responsible for protecting the main Updater agent from spam and noise. Only pass through events that clearly match the user's intent.

IMPORTANT: You do NOT have access to tools. You cannot inspect the current state of the target document.
- If the user prompt or any prompt asks you to make a decision that requires knowing the current state of the target document, you should assume the event is relevant and pass it through.
- Do not attempt to make tool calls - you have no tools available.
- Base your decision solely on the event content and the user's channel instructions provided to you.

Guidelines:
- Be strict but not overly restrictive.
- Consider both the event content and the user's channel instructions.
- If a decision requires document state knowledge, default to isRelevant: true with appropriate confidence.
- If unsure, choose the lower-confidence option.`;
}

function buildFilterUserPrompt(userInstructions: string, eventContent: string): string {
    return `User's Channel Instructions:
${userInstructions}

---

Incoming Event:
${eventContent}

---

Determine relevance based on the event content and user instructions. If making this decision requires knowing the current state of the target document, assume the event is relevant. Output should match the required schema (isRelevant, reason, confidence).`;
}