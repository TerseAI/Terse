import { settings } from "../../settings"

import { TavilyWebSearchService } from "./TavilyWebSearchService"
import type { WebSearchService } from "./WebSearchService"

let instance: WebSearchService | undefined

export function getWebSearchService(): WebSearchService {
    if (!instance) {
        if (!settings.tavily.apiKey) {
            throw new Error("TAVILY_API_KEY is required to use the web search tools")
        }
        instance = new TavilyWebSearchService(settings.tavily.apiKey)
    }
    return instance
}
