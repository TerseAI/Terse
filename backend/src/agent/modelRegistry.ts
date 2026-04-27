import { createAnthropic } from "@ai-sdk/anthropic"
import { createOpenAI } from "@ai-sdk/openai"
import { createProviderRegistry } from "ai"

export const DEFAULT_MODEL_REF = "openai:gpt-5.2"

const SUPPORTED_PROVIDERS = ["anthropic", "openai"] as const
type SupportedProvider = (typeof SUPPORTED_PROVIDERS)[number]

export type ModelReference = {
    providerId: SupportedProvider
    modelId: string
    value: `${SupportedProvider}:${string}`
}

export function getDefaultModelRef(): string {
    return DEFAULT_MODEL_REF
}

export function listSupportedProviders(): readonly SupportedProvider[] {
    return SUPPORTED_PROVIDERS
}

export function parseModelReference(input: string): ModelReference {
    const value = input.trim()
    const separatorIndex = value.indexOf(":")

    if (separatorIndex <= 0 || separatorIndex === value.length - 1) {
        throw new Error(`Model must use the AI SDK provider registry format "provider:modelId"; received "${input}".`)
    }

    const providerId = value.slice(0, separatorIndex)
    const modelId = value.slice(separatorIndex + 1)

    if (!isSupportedProvider(providerId)) {
        throw new Error(`Unsupported provider "${providerId}". Supported providers: ${SUPPORTED_PROVIDERS.join(", ")}.`)
    }

    return { providerId, modelId, value: `${providerId}:${modelId}` }
}

export function resolveLanguageModel(modelRef: string = getDefaultModelRef()) {
    const parsed = parseModelReference(modelRef)
    const registry = createProviderRegistry({
        anthropic: createAnthropic(),
        openai: createOpenAI()
    })

    return {
        ...parsed,
        model: registry.languageModel(parsed.value)
    }
}

function isSupportedProvider(providerId: string): providerId is SupportedProvider {
    return (SUPPORTED_PROVIDERS as readonly string[]).includes(providerId)
}
