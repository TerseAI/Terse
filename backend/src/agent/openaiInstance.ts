import { setDefaultOpenAIClient } from "@openai/agents"
import { OpenAI as PostHogOpenAI } from "@posthog/ai"
import { OpenAI as OpenAIApi } from "openai"

import logger from "../logger"
import { analytics } from "../utility/analytics"

export function setupLLMAnalytics(): void {
    const openaiKey = process.env.OPENAI_API_KEY
    const posthogClient = analytics.getPostHogClient()

    if (!openaiKey || !posthogClient) {
        logger.warn("LLM analytics disabled: missing OpenAI key or PostHog client", {
            hasOpenAIKey: !!openaiKey,
            hasPostHogClient: !!posthogClient
        })
        return
    }

    const openai = new PostHogOpenAI({
        apiKey: openaiKey,
        posthog: posthogClient
    })

    // PostHogOpenAI extends OpenAI but WrappedResponses changes method signatures,
    // so we need to force the type through. At runtime this is structurally compatible.
    setDefaultOpenAIClient(openai as unknown as OpenAIApi)
    logger.info("LLM analytics initialized (PostHog-wrapped OpenAI client set as default)")
}
