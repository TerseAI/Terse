import { tool } from "@openai/agents"
import { tavily } from "@tavily/core"
import { z } from "zod"

import { settings } from "../../../config/settings"
import { ToolName } from "../../../tools/ToolNames"

export const tavilyExtractTool = tool({
    name: ToolName.WEB_EXTRACT,
    description: "Extract the full text content from one or more web page URLs. Use this when you need to read the complete contents of a specific page.",
    parameters: z.object({
        urls: z.union([z.string(), z.array(z.string())]).describe("URL or list of URLs to extract content from"),
        extract_depth: z.enum(["basic", "advanced"]).nullable().describe("'advanced' handles JavaScript-heavy pages but is slower")
    }),
    execute: async ({ urls, extract_depth }) => {
        const client = tavily({ apiKey: settings.tavily.apiKey })
        const urlList = Array.isArray(urls) ? urls : [urls]
        let extract_depth_value: "basic" | "advanced" = "basic"
        if (extract_depth) {
            extract_depth_value = extract_depth
        }

        const response = await client.extract(urlList, {
            extractDepth: extract_depth_value
        })
        return {
            results: response.results.map(r => ({
                url: r.url,
                raw_content: r.rawContent
            })),
            failed_results: response.failedResults
        }
    }
})
