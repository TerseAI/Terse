import { settings } from "../../config/settings"

import type { WebSearchService } from "./WebSearchService"
import { TavilyWebSearchService } from "./TavilyWebSearchService"

let instance: WebSearchService | undefined

export function getWebSearchService(): WebSearchService {
    if (!instance) {
        instance = new TavilyWebSearchService(settings.tavily.apiKey)
    }
    return instance
}
