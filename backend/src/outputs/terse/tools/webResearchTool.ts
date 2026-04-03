import { getWebSearchService } from "../../../services/webSearch"
import { defineSessionTool } from "../../../tools/toolUtils"

export const webResearchTool = defineSessionTool({
    name: "web_research",
    description:
        "Conduct deep, multi-source research on a topic. Autonomously searches across many sources and returns a comprehensive report with citations. Best for complex questions requiring synthesis across multiple sources. Takes longer than a regular search (up to 2 minutes).",
    execute: async ({ input, model }) => {
        const service = getWebSearchService()
        const result = await service.research({
            input,
            model: model ?? "auto"
        })
        return {
            success: true,
            ...result
        }
    }
})
