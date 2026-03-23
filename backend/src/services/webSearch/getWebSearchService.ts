import { settings } from "../../config/settings"

import { TavilyWebSearchService } from "./TavilyWebSearchService"
import type { WebSearchService } from "./WebSearchService"

let instance: WebSearchService | undefined

export function getWebSearchService(): WebSearchService {
    if (!instance) {
        instance = new TavilyWebSearchService(settings.tavily.apiKey)
    }
    return instance
}
