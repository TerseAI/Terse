import OpenAI from 'openai';
import { openai as openaiConfig } from '../../config/settings';
import { GenerateSurveyPromptRequest } from '../../shared/PromptBuilderTypes';
import { ConfigType } from '../../shared/Configs';

const openai = new OpenAI({ apiKey: openaiConfig.apiKey });

function formatConfigContext(inputConfigs?: Array<{ type: ConfigType; details?: string }>, outputConfig?: { type: ConfigType; details?: string }): string {
  let context = '';
  
  if (inputConfigs && inputConfigs.length > 0) {
    context += 'Input Sources:\n';
    inputConfigs.forEach((config, idx) => {
      context += `  ${idx + 1}. ${config.type}`;
      if (config.details) {
        context += ` (${config.details})`;
      }
      context += '\n';
    });
  }
  
  if (outputConfig) {
    context += `Output Destination: ${outputConfig.type}`;
    if (outputConfig.details) {
      context += ` (${outputConfig.details})`;
    }
    context += '\n';
  }
  
  return context || 'No integrations configured yet.';
}

export async function generateSurveyPrompt(request: GenerateSurveyPromptRequest): Promise<string> {
  try {
    const configContext = formatConfigContext(request.inputConfigs, request.outputConfig);
    
    // Format answers for the prompt
    const answersText = Object.entries(request.answers)
      .map(([questionIdx, answer]) => {
        if (Array.isArray(answer)) {
          if (answer.length === 0 || answer.includes('e')) return null; // Skip if empty or includes skip
          const answerText = answer.join(', ');
          const writeIn = request.writeInAnswers?.[questionIdx];
          return `Question ${parseInt(questionIdx) + 1}: ${answerText}${writeIn ? ` (Write-in: ${writeIn})` : ''}`;
        } else {
          if (answer === 'e') return null; // Skip skipped questions
          const writeIn = request.writeInAnswers?.[questionIdx];
          return `Question ${parseInt(questionIdx) + 1}: ${answer}${writeIn ? ` (Write-in: ${writeIn})` : ''}`;
        }
      })
      .filter(Boolean)
      .join('\n');
    
    // Include write-in only answers (when user only provided write-in, no option selected)
    const writeInOnlyText = Object.entries(request.writeInAnswers || {})
      .filter(([questionIdx]) => {
        const answer = request.answers[questionIdx];
        // Only include if no option was selected (or only 'e' was selected)
        if (Array.isArray(answer)) {
          return answer.length === 0 || (answer.length === 1 && answer[0] === 'e');
        }
        return !answer || answer === 'e';
      })
      .map(([questionIdx, writeIn]) => {
        if (writeIn && typeof writeIn === 'string' && writeIn.trim()) {
          return `Question ${parseInt(questionIdx) + 1} (Write-in): ${writeIn}`;
        }
        return null;
      })
      .filter(Boolean)
      .join('\n');
    
    const allAnswersText = [answersText, writeInOnlyText].filter(Boolean).join('\n');

    const systemPrompt = `You are an expert at creating detailed, effective prompts for AI automation agents.

Your task is to generate a comprehensive prompt that instructs an AI agent on how to process events from input sources and generate appropriate outputs.

IMPORTANT: Do not include any integration IDs, database IDs, channel IDs, project IDs, team IDs, or other technical identifiers in the generated prompt. Only use human-readable information like channel names, project names, database names, etc.

Context:
- Input Sources: ${request.inputConfigs?.length || 0} configured
- Output Destination: ${request.outputConfig ? request.outputConfig.type : 'Not configured'}
${configContext}
${request.existingPrompt ? `- Existing Prompt (for reference): ${request.existingPrompt}` : '- No existing prompt'}

Guidelines for the prompt:
1. Be specific about what information to extract or focus on
2. Clearly describe how to format or structure the output
3. Include rules for filtering or prioritizing events
4. Specify the tone or style for generated content
5. Consider the configured input and output integrations
6. Make the prompt actionable and clear
7. Include examples where helpful
8. Be concise but comprehensive
9. Never include technical IDs - only use human-readable names and descriptions

The prompt should be ready to use directly in an automation system.`;

    const userPrompt = `User's initial description:
${request.description}

${allAnswersText ? `User's answers to clarifying questions:\n${allAnswersText}` : 'User skipped all clarifying questions.'}

Generate a comprehensive prompt based on this information.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_completion_tokens: 2000
    });

    const prompt = completion.choices?.[0]?.message?.content?.trim();
    if (!prompt) {
      throw new Error('No prompt returned from OpenAI');
    }

    return prompt;
  } catch (err: any) {
    throw new Error(`OpenAI API error: ${err.message || err}`);
  }
}

