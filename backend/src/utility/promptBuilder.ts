import OpenAI from 'openai';
import { openai as openaiConfig } from '../config/settings';
import { ConfigType } from '../shared/Configs';

const openai = new OpenAI({ apiKey: openaiConfig.apiKey });

export type QuestionType = 'single' | 'multiple';

export interface Question {
  question: string;
  type: QuestionType; // 'single' for radio buttons, 'multiple' for checkboxes
  allowWriteIn?: boolean; // If true, user can provide a custom text answer
  options: {
    a: string;
    b: string;
    c: string;
    d: string;
    e: string; // Always "Skip this question"
  };
}

export interface GenerateQuestionsRequest {
  description: string;
  existingPrompt?: string;
  inputConfigs?: Array<{ type: ConfigType; details?: any }>;
  outputConfig?: { type: ConfigType; details?: any };
}

export interface GeneratePromptRequest {
  description: string;
  answers: Record<string, string | string[]>; // question index -> answer(s) - string for single choice, string[] for multiple choice
  writeInAnswers?: Record<string, string>; // question index -> write-in text answer
  existingPrompt?: string;
  inputConfigs?: Array<{ type: ConfigType; details?: any }>;
  outputConfig?: { type: ConfigType; details?: any };
}

function formatConfigContext(inputConfigs?: Array<{ type: ConfigType; details?: any }>, outputConfig?: { type: ConfigType; details?: any }): string {
  let context = '';
  
  // Helper function to filter out integration IDs from details string
  function filterIntegrationIds(detailsString: string | undefined): string | undefined {
    if (!detailsString) return undefined;
    
    // Remove lines containing "Integration ID:"
    const lines = detailsString.split('\n');
    const filteredLines = lines.filter(line => {
      const lowerLine = line.toLowerCase().trim();
      return !lowerLine.includes('integration id:');
    });
    
    return filteredLines.join('\n').trim() || undefined;
  }
  
  if (inputConfigs && inputConfigs.length > 0) {
    context += 'Input Sources:\n';
    inputConfigs.forEach((config, idx) => {
      context += `  ${idx + 1}. ${config.type}`;
      const filteredDetails = filterIntegrationIds(config.details);
      if (filteredDetails) {
        context += ` (${filteredDetails})`;
      }
      context += '\n';
    });
  }
  
  if (outputConfig) {
    context += `Output Destination: ${outputConfig.type}`;
    const filteredDetails = filterIntegrationIds(outputConfig.details);
    if (filteredDetails) {
      context += ` (${filteredDetails})`;
    }
    context += '\n';
  }
  
  return context || 'No integrations configured yet.';
}

export async function generateQuestions(request: GenerateQuestionsRequest): Promise<Question[]> {
  try {
    const configContext = formatConfigContext(request.inputConfigs, request.outputConfig);
    
    const systemPrompt = `You are an expert at understanding automation workflows and helping users create effective prompts for AI agents.

Your task is to generate up to 3 clarifying multiple-choice questions to help refine a user's automation prompt.

Context:
- Input Sources: ${request.inputConfigs?.length || 0} configured
- Output Destination: ${request.outputConfig ? request.outputConfig.type : 'Not configured'}
${configContext}
${request.existingPrompt ? `- Existing Prompt: ${request.existingPrompt}` : '- No existing prompt'}

Guidelines:
1. Generate 1-3 questions maximum
2. Each question must have exactly 5 options: a, b, c, d, and e (where e is always "Skip this question")
3. For each question, determine if it should be:
   - "single" (radio button): When only one answer makes sense (e.g., "What is the primary focus?")
   - "multiple" (checkboxes): When multiple answers can apply (e.g., "Which types of events should be monitored?" or "What information should be included?")
4. For each question, determine if it should allow a write-in answer:
   - Set "allowWriteIn": true when the question would benefit from custom, specific input that can't be captured in predefined options
   - Examples: "What specific keywords or phrases should trigger this automation?", "Describe the exact format you want for the output", "What are the specific criteria for filtering?"
   - Set "allowWriteIn": false (or omit) for questions where the options are sufficient
5. Questions should help clarify:
   - What specific information to extract or focus on
   - How to format or structure the output
   - Rules for filtering or prioritizing events
   - The tone or style for generated content
   - Any specific behaviors or edge cases
6. Questions should be relevant to the user's description and the configured integrations
7. If the user's description is very clear and complete, you may generate fewer questions (even just 1)

Return your response as a JSON object with a "questions" array. Each question object should have:
- "question": string (the question text)
- "type": string (either "single" for radio buttons or "multiple" for checkboxes)
- "allowWriteIn": boolean (optional, true if user should be able to provide custom text answer)
- "options": object with keys "a", "b", "c", "d", "e" (all strings)

Example format:
{
  "questions": [
    {
      "question": "What should be the primary focus when processing events?",
      "type": "single",
      "allowWriteIn": false,
      "options": {
        "a": "Extract all available information",
        "b": "Focus only on critical updates",
        "c": "Summarize key changes",
        "d": "Track specific metrics",
        "e": "Skip this question"
      }
    },
    {
      "question": "Which types of information should be included in the output?",
      "type": "multiple",
      "allowWriteIn": false,
      "options": {
        "a": "Title and description",
        "b": "Assignee information",
        "c": "Priority level",
        "d": "Related links",
        "e": "Skip this question"
      }
    },
    {
      "question": "What specific keywords or phrases should trigger this automation?",
      "type": "single",
      "allowWriteIn": true,
      "options": {
        "a": "Bug-related keywords",
        "b": "Priority keywords",
        "c": "Status change keywords",
        "d": "Custom keywords",
        "e": "Skip this question"
      }
    }
  ]
}`;

    const userPrompt = `User's initial description:
${request.description}

Generate clarifying questions to help refine this automation prompt.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-5.1',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_completion_tokens: 1000
    });

    const content = completion.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    // Parse the JSON response
    const parsed = JSON.parse(content);
    
    // Handle both array and object with questions array
    let questions: Question[] = [];
    if (Array.isArray(parsed)) {
      questions = parsed;
    } else if (parsed.questions && Array.isArray(parsed.questions)) {
      questions = parsed.questions;
    } else if (parsed.question && parsed.options) {
      // Single question wrapped in object
      questions = [parsed];
    } else {
      throw new Error('Invalid response format from OpenAI');
    }

    // Validate and ensure max 3 questions
    questions = questions.slice(0, 3);
    
    // Ensure all questions have the required structure
    questions = questions.map(q => ({
      question: q.question || '',
      type: (q.type === 'multiple' ? 'multiple' : 'single') as QuestionType, // Default to 'single' if not specified
      allowWriteIn: q.allowWriteIn === true, // Default to false if not specified
      options: {
        a: q.options?.a || '',
        b: q.options?.b || '',
        c: q.options?.c || '',
        d: q.options?.d || '',
        e: q.options?.e || 'Skip this question'
      }
    }));

    return questions;
  } catch (err: any) {
    throw new Error(`OpenAI API error: ${err.message || err}`);
  }
}

export async function generatePrompt(request: GeneratePromptRequest): Promise<string> {
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
        if (writeIn && writeIn.trim()) {
          return `Question ${parseInt(questionIdx) + 1} (Write-in): ${writeIn}`;
        }
        return null;
      })
      .filter(Boolean)
      .join('\n');
    
    const allAnswersText = [answersText, writeInOnlyText].filter(Boolean).join('\n');

    const systemPrompt = `You are an expert at creating detailed, effective prompts for AI automation agents.

Your task is to generate a comprehensive prompt that instructs an AI agent on how to process events from input sources and generate appropriate outputs.

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

