import { z } from "zod"

import { SessionWithTracking } from "../../../agent/AgentRunner/BaseAgentRunner"
import { ChatAgentContext } from "../../../agent/ChatAgent/ChatAgentContext"
import { getWebSearchService } from "../../../services/webSearch"
import { ToolName } from "../../../tools/ToolNames"
import { TypedToolOptions } from "../../../tools/toolUtils"
import { Session } from "../../../types/session"

const parameters = z.object({
    query: z.string().describe("The search query"),
    max_results: z.number().int().min(1).max(10).nullable().describe("Number of results to return (default 5)"),
    search_depth: z.enum(["basic", "advanced"]).nullable().describe("'basic' is faster, 'advanced' is more thorough (default 'basic')"),
    include_answer: z.boolean().nullable().describe("Include an LLM-generated answer summarizing the results (default false)"),
    topic: z.enum(["general", "news"]).nullable().describe("'news' for recent news articles, 'general' for all web content (default 'general')"),
    time_range: z.enum(["day", "week", "month", "year"]).nullable().describe("Filter results by recency")
})

export const webSearchTool: TypedToolOptions<typeof parameters, typeof ToolName.WEB_SEARCH> = {
    name: ToolName.WEB_SEARCH,
    description:
        "Search the web for up-to-date information. Returns ranked results with titles, URLs, and content snippets. Use for questions about current events, facts, or topics requiring web sources.",
    parameters: parameters,
    execute: async ({ query, max_results, search_depth, include_answer, topic, time_range }) => {
        const service = getWebSearchService()
        return service.search({
            query,
            maxResults: max_results ?? 5,
            searchDepth: search_depth ?? "basic",
            includeAnswer: include_answer ?? false,
            topic: topic ?? "general",
            timeRange: time_range ?? undefined
        })
    }
}

export const chatWebSearchTool: TypedToolOptions<typeof parameters, typeof ToolName.WEB_SEARCH, ChatAgentContext> = webSearchTool

export const runHistoryWebSearchTool: TypedToolOptions<typeof parameters, typeof ToolName.WEB_SEARCH, SessionWithTracking<Session>> = webSearchTool
