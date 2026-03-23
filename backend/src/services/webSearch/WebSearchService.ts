import type { WebExtractRequest, WebExtractResponse, WebResearchRequest, WebResearchResponse, WebSearchRequest, WebSearchResponse } from "./types"

export interface WebSearchService {
    search(input: WebSearchRequest): Promise<WebSearchResponse>

    extract(input: WebExtractRequest): Promise<WebExtractResponse>

    research(input: WebResearchRequest): Promise<WebResearchResponse>
}
