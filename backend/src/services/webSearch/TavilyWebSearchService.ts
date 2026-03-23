import { tavily } from "@tavily/core"

import logger from "../../logger"

import type { WebSearchService } from "./WebSearchService"
import type {
    WebExtractRequest,
    WebExtractResponse,
    WebResearchRequest,
    WebResearchResponse,
    WebSearchRequest,
    WebSearchResponse
} from "./types"

const POLL_INTERVAL_MS = 5000
const MAX_WAIT_MS = 120_000

export class TavilyWebSearchService implements WebSearchService {
    private readonly client: ReturnType<typeof tavily>

    constructor(apiKey: string) {
        this.client = tavily({ apiKey })
    }

    async search(input: WebSearchRequest): Promise<WebSearchResponse> {
        const response = await this.client.search(input.query, {
            maxResults: input.maxResults,
            searchDepth: input.searchDepth,
            includeAnswer: input.includeAnswer,
            topic: input.topic,
            timeRange: input.timeRange
        })
        return {
            query: response.query,
            answer: response.answer,
            results: response.results.map(r => ({
                title: r.title,
                url: r.url,
                content: r.content,
                score: r.score
            }))
        }
    }

    async extract(input: WebExtractRequest): Promise<WebExtractResponse> {
        const response = await this.client.extract(input.urls, {
            extractDepth: input.extractDepth
        })
        return {
            results: response.results.map(r => ({
                url: r.url,
                raw_content: r.rawContent
            })),
            failed_results: response.failedResults
        }
    }

    async research(input: WebResearchRequest): Promise<WebResearchResponse> {
        const submitted = await this.client.research(input.input, { model: input.model, stream: false })
        if (Symbol.asyncIterator in submitted) {
            throw new Error("Unexpected streaming response from research endpoint")
        }
        const { requestId } = submitted
        logger.info("[TavilyWebSearchService] Research submitted", { requestId, input: input.input })

        const start = Date.now()
        while (Date.now() - start < MAX_WAIT_MS) {
            await sleep(POLL_INTERVAL_MS)
            const status = await this.client.getResearch(requestId)
            logger.info("[TavilyWebSearchService] Research poll", { requestId, status: status.status })

            if (status.status === "completed") {
                const completed = status as { content?: string; sources?: Array<{ title: string; url: string }> }
                return {
                    status: "completed",
                    request_id: requestId,
                    content: completed.content,
                    sources: completed.sources
                }
            }

            if (status.status === "failed") {
                throw new Error(`Research task failed (request_id: ${requestId})`)
            }
        }

        throw new Error(`Research task timed out after ${MAX_WAIT_MS / 1000}s (request_id: ${requestId})`)
    }
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
}
