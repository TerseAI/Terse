import { JudgeAgentOutputType } from "../agent/JudgeAgent/JudgeAgent"
import { buildClaudeCodePrompt } from "../agent/JudgeAgent/buildClaudeCodePrompt"
import { JudgeContext } from "../agent/JudgeAgent/fetchJudgeContext"
import logger from "../logger"

import { ClaudeCodeSandboxService } from "./ClaudeCodeSandboxService"
import { downloadSdkDeployZip } from "./FileStorageService"

const IMPROVEMENTS_SCHEMA = {
    type: "object",
    properties: {
        title: { type: "string", description: "Short headline for the review, under 8 words" },
        summary: { type: "string", description: "1-2 casual sentences summarizing the review" },
        improvements: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    title: { type: "string", description: "Short punchy title for the improvement" },
                    description: { type: "string", description: "1-2 plain sentences explaining what's wrong and what to do" },
                    targetArea: { type: "string", enum: ["code", "trigger_config", "output_config", "general"] },
                    confidence: { type: "number", minimum: 0, maximum: 1 },
                    suggestedPatch: { type: "string", description: "The exact output of git diff for this improvement" }
                },
                required: ["title", "description", "targetArea", "confidence"]
            }
        }
    },
    required: ["title", "summary", "improvements"]
}

export class SdkImprovementService {
    private sandbox = new ClaudeCodeSandboxService()

    async evaluate(automationId: string, context: JudgeContext): Promise<JudgeAgentOutputType> {
        const gcsKey = context.agentConfig.gcsKey

        if (!gcsKey) {
            logger.warn("[SdkImprovementService] No GCS key for source code", { automationId })
            return { title: "No source code available", summary: "Could not find source code to review.", improvements: [] }
        }

        const zipBuffer = await downloadSdkDeployZip(gcsKey)
        if (!zipBuffer) {
            logger.warn("[SdkImprovementService] Failed to download zip", { automationId })
            return { title: "Source code unavailable", summary: "Could not download source code.", improvements: [] }
        }

        const prompt = buildClaudeCodePrompt(automationId, context)

        try {
            const result = await this.sandbox.run({
                label: `sdk-improvement-${automationId}`,
                prompt,
                sourceZip: zipBuffer,
                gitInit: true,
                jsonSchema: IMPROVEMENTS_SCHEMA
            })

            if (!result.stdout) {
                logger.error("[SdkImprovementService] No stdout from Claude Code", { automationId, exitCode: result.exitCode })
                return { title: "Review failed", summary: "Claude Code did not produce results.", improvements: [] }
            }

            return parseResults(result.stdout, automationId)
        } catch (error) {
            logger.error("[SdkImprovementService] Evaluation failed", { automationId, error })
            return { title: "Review failed", summary: "An error occurred during the review.", improvements: [] }
        }
    }
}

function parseResults(fileContent: string, automationId: string): JudgeAgentOutputType {
    try {
        // Claude Code --output-format json writes: { type, result, structured_output, ... }
        // With --json-schema, the validated object is in structured_output
        const claudeOutput = JSON.parse(fileContent)
        const parsed = claudeOutput.structured_output
            ?? (typeof claudeOutput.result === "string" && claudeOutput.result ? JSON.parse(claudeOutput.result) : claudeOutput.result)

        if (!parsed || !parsed.title) {
            logger.error("[SdkImprovementService] No parseable result in Claude Code output", { automationId, keys: Object.keys(claudeOutput) })
            return { title: "Review failed", summary: "Claude Code did not return structured output.", improvements: [] }
        }

        return {
            title: parsed.title,
            summary: parsed.summary,
            improvements: (parsed.improvements ?? []).map((imp: Record<string, unknown>) => ({
                title: imp.title as string,
                description: imp.description as string,
                targetArea: imp.targetArea as string,
                confidence: imp.confidence as number,
                suggestedPatch: imp.suggestedPatch as string | undefined
            }))
        }
    } catch (error) {
        logger.error("[SdkImprovementService] Failed to parse Claude Code output", { automationId, error, contentLength: fileContent.length, contentTail: fileContent.slice(-300) })
        return { title: "Review failed", summary: "Could not parse improvement results.", improvements: [] }
    }
}
