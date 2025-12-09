import { Agent, AgentInputItem, run, StreamedRunResult, AgentOutputType } from '@openai/agents';
import { InputEvent } from "../../integrations/abstract/InputEvent";
import { ChannelPrompt } from "../../types/prisma";
import { Session } from "../../server";
import { ModelEvent } from '../../shared/ModelEvents';
import { transformAgentStreamToModelEvents } from '../streaming';
import { z } from "zod";
import type { RunHistoryStreamingParams, RunHistoryModelEvent, RunHistoryModelSocketEvent } from '../../shared/RunHistoryTypes';
import { storeChatEvent } from './runHistory';
import { getRealtimeSocket } from '../../realtimeSocket';
import { randomString } from '../../utility/strings';
import { settings } from '../../config/settings';
import { runnerFactory } from '../runner';

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

function buildFilterSystemPrompt(currentTimeUtc: string): string {
    return `
You are EVENT_FILTER, a strict but fair event relevance analyzer.

Your PURPOSE is to decide whether a single incoming event should be forwarded to the Living Document Updater agent for processing.

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

You may provide additional context and analysis in your text response, but you MUST include the structured JSON output.
`;
}

/**
 * Filters a single event to determine if it's relevant to the channel based on user instructions
 * Returns both the filter result and an async generator for streaming events
 * 
 * If streamingParams are provided, automatically handles storing events and emitting them via Socket.IO
 */
export async function filterEvent<T extends Session>(
    event: InputEvent,
    channelPrompt: ChannelPrompt,
    session: T,
    streamingParams?: RunHistoryStreamingParams
): Promise<{ result: EventFilterResult; stream: StreamedRunResult<T, Agent<T, any>> }> {
    try {
        const currentTimeUtc = new Date().toISOString();
        const systemPrompt = buildFilterSystemPrompt(currentTimeUtc);
        
        const agent = new Agent<T, typeof filterOutputSchema>({
            name: 'Channel Event Filter',
            instructions: systemPrompt,
            model: 'gpt-4o-mini',
            modelSettings: {
                temperature: 0.3,
                maxTokens: 200
            },
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
        const runner = runnerFactory({
            runHistoryId: streamingParams?.runId || '',
            env: settings.nodeEnv,
        })
        const result = await runner.run(agent, history);

        if (result.interruptions && result.interruptions.length > 0) {
            throw new Error('Filter agent requested tool approval, which is not supported for event filtering.');
        }

        // Handle streaming and channel management if streamingParams are provided
        if (streamingParams?.runId && streamingParams?.userId && streamingParams?.channelId) {
            const io = getRealtimeSocket();
            const userRoom = `user:${streamingParams.userId}`;
            
            try {
                for await (const modelEvent of transformAgentStreamToModelEvents(result)) {
                    // Skip TextDelta events from filter agent - we'll store the structured FilterResult instead
                    if (modelEvent.type === 'TextDelta') {
                        continue;
                    }
                    
                    // Store event in database and get the ID
                    const eventId = await storeChatEvent(streamingParams.runId, modelEvent);
                    
                    // Emit event via Socket.IO with timestamp and ID
                    if (io) {
                        const runHistoryModelEvent: RunHistoryModelEvent = {
                            ...modelEvent,
                            id: eventId,
                            timestamp: new Date().toISOString(),
                        };
                        const payload: RunHistoryModelSocketEvent = {
                            runId: streamingParams.runId,
                            channelId: streamingParams.channelId,
                            runHistoryModelEvent,
                        };
                        io.to(userRoom).emit('channel:chat:event', payload);
                    }
                }
            } catch (error) {
                console.error('Error streaming filter events:', error);
                // Continue with parsing even if streaming fails
            }
        }

        // Get structured output from result
        const parsed = result.finalOutput ?? null;
        if (!parsed) {
            throw new Error('No final output from filter agent');
        }

        // Clamp confidence to [0, 1]
        parsed.confidence = Math.max(0, Math.min(1, parsed.confidence));

        // Store and emit the filter result event if streamingParams are provided
        if (streamingParams?.runId && streamingParams?.userId && streamingParams?.channelId) {
            const filterResultEvent = {
                type: 'FilterResult' as const,
                isRelevant: parsed.isRelevant,
                reason: parsed.reason,
                confidence: parsed.confidence,
                step_id: randomString(15),
            };
            const filterEventId = await storeChatEvent(streamingParams.runId, filterResultEvent);
            
            const io = getRealtimeSocket();
            if (io) {
                const userRoom = `user:${streamingParams.userId}`;
                const runHistoryModelEvent: RunHistoryModelEvent = {
                    ...filterResultEvent,
                    id: filterEventId,
                    timestamp: new Date().toISOString(),
                };
                const payload: RunHistoryModelSocketEvent = {
                    runId: streamingParams.runId,
                    channelId: streamingParams.channelId,
                    runHistoryModelEvent,
                };
                io.to(userRoom).emit('channel:chat:event', payload);
            }
        }

        console.log(`Event filter result for ${event.integrationType}:`, parsed);
        return { result: parsed, stream: result };

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

<ROLE>
You are an event relevance analyzer. Your job is to determine if an incoming event is relevant to a user's automation instructions.

You are responsible for protecting the main Updater agent from spam and noise. 

The way the main system works is we listen for events from a set of inputs, then send them to a model with a custom user prompt. Then we have an output that we update based on the event.
</ROLE>

<TASK>
Decide if the INCOMING_EVENT is relevant to the USER_CHANNEL_INSTRUCTIONS for routing to the Living Document Updater agent.

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
`.trim();
}