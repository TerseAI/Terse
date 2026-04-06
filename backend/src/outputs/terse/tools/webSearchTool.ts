import { SessionWithTracking } from "../../../agent/AgentRunner/AgentRunner"
import { ChatAgentContext } from "../../../agent/ChatAgent/ChatAgentContext"
import { getWebSearchService } from "../../../services/webSearch/getWebSearchService"
import { TypedToolOptions, defineTool } from "../../../tools/toolUtils"
import { Session } from "../../../types/session"

export const webSearchTool = defineTool({
    name: "web_search",
    description:
        "Search the web for up-to-date information. Returns ranked results with titles, URLs, and content snippets. Use for questions about current events, facts, or topics requiring web sources.",
    execute: async ({ query, max_results, search_depth, include_answer, topic, time_range }) => {
        const service = getWebSearchService()
        return await service.search({
            query,
            maxResults: max_results ?? 5,
            searchDepth: search_depth ?? "basic",
            includeAnswer: include_answer ?? false,
            topic: topic ?? "general",
            timeRange: time_range ?? undefined
        })
    }
})

export const chatWebSearchTool: TypedToolOptions<"web_search", ChatAgentContext> = webSearchTool

export const runHistoryWebSearchTool: TypedToolOptions<"web_search", SessionWithTracking<Session>> = webSearchTool
