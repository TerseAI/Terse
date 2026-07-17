import { createAnthropic } from "@ai-sdk/anthropic"
import { createOpenAI } from "@ai-sdk/openai"
import { createProviderRegistry } from "ai"
import { ModelReference, SUPPORTED_PROVIDERS, SupportedProvider } from "terse-types"

import { settings } from "../../settings"

const DEFAULT_MODEL_REF = "openai:gpt-5.6-sol"

function getDefaultModelRef(): string {
    return DEFAULT_MODEL_REF
}

export function getConfiguredModelReference(): string {
    const modelRef = settings.aisdk.default
    if (!modelRef?.trim()) {
        throw new Error("Default model not set. Set MODEL_DEFAULT (e.g. openai:gpt-5.6-sol).")
    }
    return modelRef
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
        model: registry.languageModel(`${parsed.providerId}:${parsed.modelId}`),
        providerData: buildProviderData(parsed.providerId)
    }
}

function buildProviderData(providerId: SupportedProvider): Record<string, unknown> {
    if (providerId === "anthropic") {
        // Enables Anthropic's automatic prompt caching. For some reason, this is not enabled by default
        // (It is for OpenAI)
        return { providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } } }
    }
    return {}
}

function isSupportedProvider(providerId: string): providerId is SupportedProvider {
    return (SUPPORTED_PROVIDERS as readonly string[]).includes(providerId)
}
