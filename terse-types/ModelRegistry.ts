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
