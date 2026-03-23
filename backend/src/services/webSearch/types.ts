/**
 * Provider-agnostic DTOs for web search, extract, and deep research.
 * Field names match tool JSON output so the model and UI stay stable when swapping providers.
 */

export type WebSearchDepth = "basic" | "advanced"

export type WebSearchTopic = "general" | "news"

export type WebSearchTimeRange = "day" | "week" | "month" | "year"

export interface WebSearchRequest {
    query: string
    maxResults: number
    searchDepth: WebSearchDepth
    includeAnswer: boolean
    topic: WebSearchTopic
    timeRange?: WebSearchTimeRange
}

export interface WebSearchResultItem {
    title: string
    url: string
    content: string
    score: number
}

export interface WebSearchResponse {
    query: string
    answer: string | undefined
    results: WebSearchResultItem[]
}

export type WebExtractDepth = "basic" | "advanced"

export interface WebExtractRequest {
    urls: string[]
    extractDepth: WebExtractDepth
}

export interface WebExtractResultItem {
    url: string
    raw_content: string
}

export interface WebExtractResponse {
    results: WebExtractResultItem[]
    /** Provider-specific failure payloads; shape varies by backend. */
    failed_results: unknown
}

export type WebResearchModel = "mini" | "pro" | "auto"

export interface WebResearchRequest {
    input: string
    model: WebResearchModel
}

export interface WebResearchSource {
    title: string
    url: string
}

export interface WebResearchResponse {
    status: "completed"
    request_id: string
    content: string | undefined
    sources: WebResearchSource[] | undefined
}
