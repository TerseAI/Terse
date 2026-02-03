import OpenAI from "openai"

import { openai as openaiConfig } from "../../config/settings"
import logger from "../../logger"
import { GenerateSurveyPromptRequest } from "../../shared/PromptBuilderTypes"

import { formatConfigContext, formatSurveyAnswers } from "./promptBuilderHelpers"

const openai = new OpenAI({ apiKey: openaiConfig.apiKey })

export async function generateSurveyPrompt(request: GenerateSurveyPromptRequest): Promise<string> {
    try {
        if (!request.questions || !Array.isArray(request.questions)) {
            throw new Error("Questions are required to generate prompt")
        }

        const configContext = formatConfigContext(request.inputConfigs, request.outputConfigs, request.knowledgeBaseConfigs)
        const allAnswersText = formatSurveyAnswers(request.questions, request.answers, request.writeInAnswers)

        const systemPrompt = `You are an expert at creating detailed, effective prompts for AI automation agents.

Your task is to generate a comprehensive prompt that instructs an AI agent on how to process events from input sources and generate appropriate outputs.

CRITICAL: The generated prompt MUST be no longer than 800 words. Be concise and focused. Prioritize clarity and actionability over verbosity.

IMPORTANT: Do not include any integration IDs, database IDs, channel IDs, project IDs, team IDs, or other technical identifiers in the generated prompt. Only use human-readable information like channel names, project names, database names, etc.

Context:
- Input Sources: ${request.inputConfigs?.length || 0} configured
- Output Destinations: ${request.outputConfigs?.length || 0} configured
- Knowledge Bases: ${request.knowledgeBaseConfigs?.length || 0} configured
${configContext}
${request.existingPrompt ? `- Existing Prompt (for reference): ${request.existingPrompt}` : "- No existing prompt"}

Guidelines for the prompt:
1. Be specific about what information to extract or focus on
2. Clearly describe how to format or structure the output (the output format should be appropriate for the destination - it may be markdown, plain text, structured data, etc.)
3. Include rules for filtering or prioritizing events
4. Specify the tone or style for generated content
5. Consider the configured input and output integrations
6. Make the prompt actionable and clear
7. Include brief examples where helpful (but keep them concise)
8. Be concise but comprehensive - aim for 600-800 words maximum
9. Never include technical IDs - only use human-readable names and descriptions
10. Format the prompt itself using markdown syntax (headers, lists, emphasis, etc.) for better readability - note that this refers to the formatting of the prompt instructions, not necessarily the output format that the agent should generate

The prompt should be ready to use directly in an automation system. The prompt itself should be formatted in markdown for readability, but the instructions within the prompt should specify what output format the agent should generate (which may or may not be markdown depending on the use case).`

        const userPrompt = `User's initial description:
${request.description}

${allAnswersText ? `User's answers to clarifying questions:\n${allAnswersText}` : "User skipped all clarifying questions."}

Generate a comprehensive prompt based on this information. Remember: keep it under 800 words and be concise.`

        const completion = await openai.chat.completions.create({
            model: "gpt-5-mini",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            max_completion_tokens: 4000
        })

        const prompt = completion.choices?.[0]?.message?.content?.trim()
        if (!prompt) {
            logger.error("No prompt in response from OpenAI", {
                finishReason: completion.choices?.[0]?.finish_reason,
                hasChoices: !!completion.choices?.length,
                choicesCount: completion.choices?.length || 0
            })
            throw new Error(`No prompt returned from OpenAI. Finish reason: ${completion.choices?.[0]?.finish_reason || "unknown"}`)
        }

        return prompt
    } catch (err: any) {
        throw new Error(`OpenAI API error: ${err.message || err}`)
    }
}
