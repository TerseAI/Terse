import OpenAI from 'openai';
import { openai as openaiConfig } from '../config/settings';

const openai = new OpenAI({ apiKey: openaiConfig.apiKey });

export async function callOpenAISummary(prompt: string): Promise<string> {
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are an expert product owner assistant. Summarize the following activity events for a daily team update. Be concise, clear, and focus on what matters to a product owner. Make sure to separate by each team member.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 256,
      temperature: 0.4
    });
    const summary = completion.choices?.[0]?.message?.content?.trim();
    if (!summary) {
      throw new Error('No summary returned from OpenAI');
    }
    return summary;
  } catch (err: any) {
    throw new Error(`OpenAI API error: ${err.message || err}`);
  }
} 