import { tool } from "@openai/agents"
import { tavily } from "@tavily/core"
import { z } from "zod"

import { settings } from "../../../config/settings"
import logger from "../../../logger"
import { ToolName } from "../../../tools/ToolNames"

const POLL_INTERVAL_MS = 5000
const MAX_WAIT_MS = 120_000

export const tavilyResearchTool = tool({
    name: ToolName.WEB_RESEARCH,
    description:
        "Conduct deep, multi-source research on a topic. Autonomously searches across many sources and returns a comprehensive report with citations. Best for complex questions requiring synthesis across multiple sources. Takes longer than a regular search (up to 2 minutes).",
    parameters: z.object({
        input: z.string().describe("The research question or topic to investigate"),
        model: z.enum(["mini", "pro", "auto"]).nullable().describe("'mini' for quick focused research, 'pro' for comprehensive multi-angle research, 'auto' picks automatically")
    }),
    execute: async ({ input, model }) => {
        const client = tavily({ apiKey: settings.tavily.apiKey })
        const modelValue = model || "auto"

        // Submit research task (non-streaming, returns immediately with requestId)
        const submitted = await client.research(input, { model: modelValue, stream: false })
        if (Symbol.asyncIterator in submitted) {
            throw new Error("Unexpected streaming response from research endpoint")
        }
        const { requestId } = submitted
        logger.info("[tavilyResearch] Submitted task", { requestId, input })

        // Poll until complete or timeout
        const start = Date.now()
        while (Date.now() - start < MAX_WAIT_MS) {
            await sleep(POLL_INTERVAL_MS)
            const status = await client.getResearch(requestId)
            logger.info("[tavilyResearch] Poll status", { requestId, status: status.status })

            if (status.status === "completed") {
                return {
                    status: "completed",
                    request_id: requestId,
                    content: (status as { content?: string }).content,
                    sources: (status as { sources?: Array<{ title: string; url: string }> }).sources
                }
            }

            if (status.status === "failed") {
                throw new Error(`Research task failed (request_id: ${requestId})`)
            }
        }

        throw new Error(`Research task timed out after ${MAX_WAIT_MS / 1000}s (request_id: ${requestId})`)
    }
})

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
}
