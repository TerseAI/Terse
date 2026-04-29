import { ModelReference } from "../agent/modelRegistry"

export type SupportedProvider = "openai" | "anthropic"

export type ModelPrice = {
    provider: SupportedProvider
    modelId: string
    inputUsdPer1M: number
    outputUsdPer1M: number
    cachedInputUsdPer1M: number
}
/**
 * Anthropic pricing reference: https://platform.claude.com/docs/en/about-claude/pricing
 * OpenAI pricing page: https://openai.com/api/pricing/
 */

export const MODEL_PRICES: ModelPrice[] = [
    {
        provider: "openai",
        modelId: "gpt-5.5",
        inputUsdPer1M: 5.0,
        outputUsdPer1M: 30.0,
        cachedInputUsdPer1M: 0.5
    },
    {
        provider: "openai",
        modelId: "gpt-5.2",
        inputUsdPer1M: 1.75,
        outputUsdPer1M: 14.0,
        cachedInputUsdPer1M: 0.175
    },
    {
        provider: "anthropic",
        modelId: "claude-opus-4-7",
        inputUsdPer1M: 5.0,
        outputUsdPer1M: 25.0,
        cachedInputUsdPer1M: 0.5
    },
    {
        provider: "anthropic",
        modelId: "claude-sonnet-4-6",
        inputUsdPer1M: 3.0,
        outputUsdPer1M: 15.0,
        cachedInputUsdPer1M: 0.3
    }
]

export function priceFor(model: ModelReference): ModelPrice | null {
    return MODEL_PRICES.find(p => p.provider === model.providerId && p.modelId === model.modelId) ?? null
}
