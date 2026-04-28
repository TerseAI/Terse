export type ModelPrice = {
    provider: "openai" | "anthropic"
    modelId: string
    inputCentsPer1k: number
    outputCentsPer1k: number
    cachedCentsPer1k: number
}

/**
 * Anthropic pricing reference: https://platform.claude.com/docs/en/about-claude/pricing
 * OpenAI pricing page: https://openai.com/api/pricing/
 */

export const MODEL_PRICES: ModelPrice[] = [
    {
        provider: "openai",
        modelId: "gpt-5.5",
        inputCentsPer1k: 0.005,
        outputCentsPer1k: 0.3,
        cachedCentsPer1k: 0.0005
    },
    {
        provider: "openai",
        modelId: "gpt-5.2",
        inputCentsPer1k: 0.005,
        outputCentsPer1k: 0.3,
        cachedCentsPer1k: 0.0005
    },
    {
        provider: "anthropic",
        modelId: "claude-opus-4-7",
        inputCentsPer1k: 0.005,
        outputCentsPer1k: 0.025,
        cachedCentsPer1k: 0.0005
    },
    {
        provider: "anthropic",
        modelId: "claude-sonnet-4-6",
        inputCentsPer1k: 0.003,
        outputCentsPer1k: 0.015,
        cachedCentsPer1k: 0.0003
    }
]

export function priceFor(provider: string, modelId: string): ModelPrice | null {
    return MODEL_PRICES.find(p => p.provider === provider && p.modelId === modelId) ?? null
}
