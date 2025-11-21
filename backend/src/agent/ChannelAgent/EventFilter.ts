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

const FILTER_SYSTEM_PROMPT = `
You are EVENT_FILTER, a strict but fair event relevance analyzer.

Your PURPOSE is to decide whether a single incoming event should be forwarded to the Living Document Updater agent for processing.

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
- It plausibly may change or update the target documentation, OR
- Determining relevance would require inspecting the current document state.

Consider an event NOT RELEVANT if:
- It is clearly spam, marketing noise, or unrelated chatter.
- It obviously does not match the user's instructions or domain.
- It contains only trivial activity with no meaningful impact on documentation or tasks.

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

Do NOT:
- Wrap the JSON in markdown.
- Add extra keys or fields.
- Include tools or function calls.

Only output the JSON object.
`;

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
            instructions: FILTER_SYSTEM_PROMPT,
            model: 'gpt-5-mini',
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

        // Clamp confidence to [0, 1]
        parsed.confidence = Math.max(0, Math.min(1, parsed.confidence));

        console.log(`Event filter result for ${event.integrationType}:`, parsed);
        return parsed;

    } catch (error) {
        // Re-throw error to be handled by the caller (EventProcessor)
        // This allows proper error tracking in run history
        throw error;
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

<TASK>
Decide if the INCOMING_EVENT is relevant to the USER_CHANNEL_INSTRUCTIONS for routing to the Living Document Updater agent.

- If the decision depends on knowing the current document state, treat the event as relevant.
- Otherwise, decide based on the textual content alone.
</TASK>

<OUTPUT_REQUIREMENTS>
Return ONLY a JSON object with the fields:
- "isRelevant": boolean
- "reason": string
- "confidence": number between 0 and 1
</OUTPUT_REQUIREMENTS>
`.trim();
}