import { JudgeAgentOutputType } from "../agent/JudgeAgent/JudgeAgent"
import { buildClaudeCodePrompt } from "../agent/JudgeAgent/buildClaudeCodePrompt"
import { JudgeContext } from "../agent/JudgeAgent/fetchJudgeContext"
import logger from "../logger"

import { ClaudeCodeSandboxService } from "./ClaudeCodeSandboxService"
import { downloadSdkDeployZip } from "./FileStorageService"

const RESULTS_PATH = "/tmp/results.json"

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
                outputFiles: [RESULTS_PATH]
            })

            const resultsJson = result.outputFiles[RESULTS_PATH]
            if (!resultsJson) {
                logger.error("[SdkImprovementService] No results file produced", { automationId, exitCode: result.exitCode })
                return { title: "Review failed", summary: "Claude Code did not produce results.", improvements: [] }
            }

            return parseResults(resultsJson, automationId)
        } catch (error) {
            logger.error("[SdkImprovementService] Evaluation failed", { automationId, error })
            return { title: "Review failed", summary: "An error occurred during the review.", improvements: [] }
        }
    }
}

function parseResults(resultsText: string, automationId: string): JudgeAgentOutputType {
    try {
        const parsed = JSON.parse(resultsText)
        return {
            title: parsed.title ?? "Review complete",
            summary: parsed.summary ?? "",
            improvements: (parsed.improvements ?? []).map((imp: Record<string, unknown>) => ({
                title: imp.title as string,
                description: imp.description as string,
                targetArea: imp.targetArea as string,
                confidence: imp.confidence as number,
                suggestedPatch: imp.suggestedPatch as string | undefined
            }))
        }
    } catch (error) {
        logger.error("[SdkImprovementService] Failed to parse results JSON", { automationId, error, resultsText: resultsText.slice(0, 1000) })
        return { title: "Review failed", summary: "Could not parse improvement results.", improvements: [] }
    }
}
