import { InputEvent } from "../../Updater/InputEvents";
import { AutomationPrompt } from "../../types/prisma";
import OpenAI from 'openai';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set in environment variables');
}

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

export interface EventFilterResult {
    isRelevant: boolean;
    reason: string;
    confidence: number; // 0-1 scale
}

/**
 * Filters a single event to determine if it's relevant to the automation based on user instructions
 */
export async function filterEvent(event: InputEvent, automationPrompt: AutomationPrompt): Promise<EventFilterResult> {
    try {
        const eventContent = event.formatForAutomationAgent();
        const userInstructions = automationPrompt.content || 'No specific instructions provided';

        const systemPrompt = `You are an event relevance analyzer. Your job is to determine if an incoming event is relevant to a user's automation instructions.

        You are responsible for protecting the main Updater agent from spam and noise. Since Emails are a common source of Inputs, we need to make sure only relevant ones make it to the main agent.

        The way the main system works, is we listen for events from a set of inputs, then send them to a model where a custom user prompt is. Then we have an output that we update based on the event.

You will be given:
1. An event (email, GitHub commit, Slack message, etc.)
2. User instructions describing what they want to automate

Your task is to decide if this event should trigger the automation based on whether it matches the user's intent.

Respond ONLY with valid JSON in this exact format:
{
  "isRelevant": true or false,
  "reason": "brief explanation of why this event is or isn't relevant",
  "confidence": 0.0 to 1.0 (how confident you are in this decision)
}

Guidelines:
- Be strict but not overly restrictive - only mark as relevant if the event clearly relates to the user's instructions
- Consider the context and intent of both the event and the instructions
- If the event is completely unrelated or spam-like, mark it as not relevant with high confidence
- If unsure, err on the side of caution with lower confidence`;

        const userPrompt = `User's Automation Instructions:
${userInstructions}

---

Incoming Event:
${eventContent}

---

Is this event relevant to the user's automation? Respond with JSON only.`;

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            response_format: { type: "json_object" },
            temperature: 0.3,
            max_tokens: 200
        });

        const responseContent = completion.choices?.[0]?.message?.content?.trim();
        if (!responseContent) {
            throw new Error('No response from OpenAI');
        }

        const result = JSON.parse(responseContent) as EventFilterResult;

        // Validate the response structure
        if (typeof result.isRelevant !== 'boolean' ||
            typeof result.reason !== 'string' ||
            typeof result.confidence !== 'number') {
            throw new Error('Invalid response structure from OpenAI');
        }

        // Ensure confidence is between 0 and 1
        result.confidence = Math.max(0, Math.min(1, result.confidence));

        console.log(`Event filter result for ${event.eventType}:`, result);
        return result;

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