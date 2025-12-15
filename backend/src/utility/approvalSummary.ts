import OpenAI from 'openai';
import { RunHistoryChatMemorySession } from "../agent/CustomMemorySession";
import { openai as openaiConfig } from "../config/settings";
import chalk from "chalk";
import { AgentInputItem } from '@openai/agents';

const openai = new OpenAI({ apiKey: openaiConfig.apiKey });

const SYSTEM_INSTRUCTIONS = `You are a helpful assistant that creates clear, human-readable summaries of actions that an AI agent wants to perform.

Your task is to summarize what action is about to be executed based on:
1. The conversation context leading up to this action
2. The tool/function name that will be called
3. The arguments/parameters that will be passed to the tool

### Guidelines:
- Write in plain, natural language that a non-technical user would understand
- Focus on WHAT will happen, not HOW (avoid technical jargon like function names or API details)
- Be concise but informative (1-3 sentences)
- If the conversation context provides clear intent, incorporate that into the summary
- If the tool name or arguments contain user-facing information (like titles, descriptions, etc.), include those details
- Make it clear what the outcome will be

### Examples:
- Instead of: "notion_modify_page with arguments: {pageId: 'abc123', title: 'New Title'}"
- Write: "Update the Notion page title to 'New Title'"

- Instead of: "linear_create_ticket with arguments: {title: 'Fix bug', description: '...'}"
- Write: "Create a Linear ticket titled 'Fix bug' with the provided description"

- Instead of: "jira_update_issue with arguments: {issueKey: 'PROJ-123', status: 'In Progress'}"
- Write: "Update Jira issue PROJ-123 to 'In Progress' status"

IMPORTANT: Return ONLY a valid JSON object with this exact format:
{"summary": "your human-readable summary here"}

Do not include any markdown formatting, code blocks, or explanations. Only return the JSON object.`;

/**
 * Generates a human-readable summary of what action is about to be performed
 * @param runId - The run history record ID
 * @param toolName - The name of the tool/function to be called
 * @param toolArguments - The arguments/parameters for the tool
 * @param channelId - The automation/channel ID
 * @param userId - The user ID
 * @returns A human-readable summary string
 */
export async function generateApprovalSummary(
  runId: string,
  toolName: string,
  toolArguments: string | object,
  channelId: string,
  userId: string
): Promise<string> {
  try {
    // Get conversation history from the session
    const session = new RunHistoryChatMemorySession({
      sessionId: runId,
      skipSave: true, // Don't save the summary generation to history
    });

    // Get recent conversation history (last 10 turns for context)
    const historyItems = await session.getItems(100); // Get enough items to have context
    
    // Format tool arguments for the prompt
    const formattedArguments = typeof toolArguments === 'string' 
      ? toolArguments 
      : JSON.stringify(toolArguments, null, 2);

    // Build messages array from history + our prompt
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: SYSTEM_INSTRUCTIONS },
    ];

    // Add conversation history (convert to OpenAI format)
    // Type guard for items with role and content
    const hasRoleAndContent = (item: AgentInputItem): item is AgentInputItem & { role: 'user' | 'assistant' | 'system'; content?: string | unknown[] } => {
      return item !== null && typeof item === 'object' && 'role' in item;
    };
    
    for (const item of historyItems) {
      if (hasRoleAndContent(item)) {
        const role = item.role as 'user' | 'assistant' | 'system';
        if (role === 'user' || role === 'assistant') {
          const content = item.content;
          if (content) {
            if (typeof content === 'string') {
              messages.push({ role, content });
            } else if (Array.isArray(content)) {
              // Handle array content
              const textContent = content.find((c: unknown) => 
                typeof c === 'string' || (c && typeof c === 'object' && 'type' in c && (c.type === 'text' || c.type === 'text_output'))
              );
              if (textContent) {
                const text = typeof textContent === 'string' 
                  ? textContent 
                  : (textContent && typeof textContent === 'object' && ('text' in textContent ? String(textContent.text) : ('content' in textContent ? String(textContent.content) : '')));
                if (text) {
                  messages.push({ role, content: text });
                }
              }
            }
          }
        }
      }
    }

    // Add our prompt
    messages.push({
      role: 'user',
      content: `The AI agent wants to execute the following tool:

Tool name: ${toolName}
Tool arguments: ${formattedArguments}

Based on the conversation context above, create a human-readable summary of what action is about to be performed.`
    });

    // Call OpenAI directly
    const completion = await openai.chat.completions.create({
      model: 'gpt-5-nano',
      messages,
      max_completion_tokens: 5000, // Increased to allow for longer, more detailed summaries
      response_format: { type: 'json_object' }, // Force JSON response
    });

    const choice = completion.choices?.[0];
    if (!choice) {
      console.error(chalk.red(`[ApprovalSummary] No choices in response. Completion:`, JSON.stringify(completion, null, 2)));
      throw new Error('No response from OpenAI');
    }

    const responseText = choice.message?.content?.trim();
    if (!responseText) {
      console.error(chalk.red(`[ApprovalSummary] No response text. Choice:`, JSON.stringify(choice, null, 2)));
      console.error(chalk.red(`[ApprovalSummary] Finish reason:`, choice.finish_reason));
      throw new Error('No response from OpenAI');
    }

    // Parse JSON response
    try {
      const parsed = JSON.parse(responseText);
      if (parsed.summary && typeof parsed.summary === 'string') {
        console.log(chalk.blue(`[ApprovalSummary] Generated summary: "${parsed.summary}"`));
        return parsed.summary;
      }
    } catch (parseError) {
      console.warn(chalk.yellow(`[ApprovalSummary] Failed to parse JSON, trying cleaned text`));
      // Try cleaning and parsing again
      const cleanedText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleanedText);
      if (parsed.summary && typeof parsed.summary === 'string') {
        return parsed.summary;
      }
    }

    // If parsing fails but we have text, use it directly if it looks reasonable
    if (responseText.length > 10 && responseText.length < 500) {
      return responseText.trim();
    }

    throw new Error('Invalid response format');
  } catch (error) {
    console.error(chalk.red(`[ApprovalSummary] Error generating summary:`, error));
    // Fallback to a simple description if AI generation fails
    const formattedArguments = typeof toolArguments === 'string' 
      ? toolArguments 
      : JSON.stringify(toolArguments);
    return `Execute ${toolName} with parameters: ${formattedArguments}`;
  }
}

