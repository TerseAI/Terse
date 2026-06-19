import { z } from "zod"

export const SUPPORTED_PROVIDERS = ["anthropic", "openai"] as const

export const supportedProviderSchema = z.enum(SUPPORTED_PROVIDERS)

export type SupportedProvider = z.infer<typeof supportedProviderSchema>

export const modelReferenceSchema = z
    .object({
        providerId: supportedProviderSchema,
        modelId: z.string().min(1),
        value: z.string().min(1)
    })
    .superRefine((data, ctx) => {
        const prefix = `${data.providerId}:`
        if (!data.value.startsWith(prefix)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `model.value must start with "${prefix}"`
            })
        }
    })

export type ModelReference = z.infer<typeof modelReferenceSchema>

export type SupportedModel = {
    providerId: SupportedProvider
    modelId: string
    value: `${SupportedProvider}:${string}`
    label: string
}

export const SUPPORTED_MODELS = [
    { providerId: "anthropic", modelId: "claude-opus-4-8", value: "anthropic:claude-opus-4-8", label: "Claude Opus 4.8" },
    { providerId: "anthropic", modelId: "claude-opus-4-7", value: "anthropic:claude-opus-4-7", label: "Claude Opus 4.7" },
    { providerId: "anthropic", modelId: "claude-sonnet-4-6", value: "anthropic:claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
    { providerId: "anthropic", modelId: "claude-haiku-4-5", value: "anthropic:claude-haiku-4-5", label: "Claude Haiku 4.5" },
    { providerId: "openai", modelId: "gpt-5.5", value: "openai:gpt-5.5", label: "GPT-5.5" },
    { providerId: "openai", modelId: "gpt-5.4", value: "openai:gpt-5.4", label: "GPT-5.4" },
    { providerId: "openai", modelId: "gpt-5.4-mini", value: "openai:gpt-5.4-mini", label: "GPT-5.4 mini" },
    { providerId: "openai", modelId: "gpt-5.4-nano", value: "openai:gpt-5.4-nano", label: "GPT-5.4 nano" },
    { providerId: "openai", modelId: "gpt-5.2", value: "openai:gpt-5.2", label: "GPT-5.2" }
] as const satisfies readonly SupportedModel[]

export const SUPPORTED_MODEL_VALUES = SUPPORTED_MODELS.map(model => model.value) as [string, ...string[]]

export type SupportedModelType = (typeof SUPPORTED_MODELS)[number]["value"]

export const supportedModelValueSchema = z.enum(SUPPORTED_MODEL_VALUES)

export function isSupportedModel(value: string): value is SupportedModelType {
    return SUPPORTED_MODEL_VALUES.includes(value)
}
