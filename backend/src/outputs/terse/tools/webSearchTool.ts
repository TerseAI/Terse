import { getWebSearchService } from "../../../services/webSearch/getWebSearchService"
import { defineTool } from "../../../tools/toolUtils"

export const webSearchTool = defineTool({
    name: "web_search",
    execute: async ({ query, max_results, search_depth, include_answer, topic, time_range, include_domains }) => {
        const service = getWebSearchService()
        return await service.search({
            query,
            maxResults: max_results ?? 5,
            searchDepth: search_depth ?? "basic",
            includeAnswer: include_answer ?? false,
            topic: topic ?? "general",
            timeRange: time_range ?? undefined,
            includeDomains: include_domains ?? undefined
        })
    }
})
