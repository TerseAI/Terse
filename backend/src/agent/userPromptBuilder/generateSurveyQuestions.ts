import OpenAI from "openai"

import { openai as openaiConfig } from "../../config/settings"
import { GenerateSurveyQuestionsRequest, SurveyQuestion, SurveyQuestionType } from "../../shared/PromptBuilderTypes"

import { formatConfigContext } from "./promptBuilderHelpers"

const openai = new OpenAI({ apiKey: openaiConfig.apiKey })

export async function generateSurveyQuestions(request: GenerateSurveyQuestionsRequest): Promise<SurveyQuestion[]> {
    try {
        const configContext = formatConfigContext(request.inputConfigs, request.outputConfigs, request.knowledgeBaseConfigs)

        const systemPrompt = `You are an expert at understanding automation workflows and helping users create effective prompts for AI agents.

Your task is to generate up to 3 clarifying multiple-choice questions to help refine a user's automation prompt.

IMPORTANT: Do not include any integration IDs, database IDs, channel IDs, or other technical identifiers in your output. Only use human-readable information like channel names, project names, database names, etc.

Context:
- Input Sources: ${request.inputConfigs?.length || 0} configured
- Output Destinations: ${request.outputConfigs?.length || 0} configured
- Knowledge Bases: ${request.knowledgeBaseConfigs?.length || 0} configured
${configContext}
${request.existingPrompt ? `- Existing Prompt: ${request.existingPrompt}` : "- No existing prompt"}

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
}`

        const userPrompt = `User's initial description:
${request.description}

Generate clarifying questions to help refine this automation prompt.`

        const completion = await openai.chat.completions.create({
            model: "gpt-5.1",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            response_format: { type: "json_object" },
            temperature: 0.7,
            max_completion_tokens: 1000
        })

        const content = completion.choices?.[0]?.message?.content?.trim()
        if (!content) {
            throw new Error("No response from OpenAI")
        }

        // Parse the JSON response
        const parsed = JSON.parse(content)

        // Handle both array and object with questions array
        let questions: SurveyQuestion[] = []
        if (Array.isArray(parsed)) {
            questions = parsed
        } else if (parsed.questions && Array.isArray(parsed.questions)) {
            questions = parsed.questions
        } else if (parsed.question && parsed.options) {
            // Single question wrapped in object
            questions = [parsed]
        } else {
            throw new Error("Invalid response format from OpenAI")
        }

        // Validate and ensure max 3 questions
        questions = questions.slice(0, 3)

        questions = questions.map(q => ({
            question: q.question || "",
            type: (q.type === "multiple" ? "multiple" : "single") as SurveyQuestionType,
            allowWriteIn: q.allowWriteIn === true,
            options: {
                a: q.options?.a || "",
                b: q.options?.b || "",
                c: q.options?.c || "",
                d: q.options?.d || "",
                e: q.options?.e || "Skip this question"
            }
        }))

        return questions
    } catch (err: any) {
        throw new Error(`OpenAI API error: ${err.message || err}`)
    }
}
