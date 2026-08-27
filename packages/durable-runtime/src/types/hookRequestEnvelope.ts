import { z } from "zod"

export const HookRequestEnvelopeSchema = z
    .object({
        type: z.literal("hook"),
        name: z.string().min(1),
        payload: z.json()
    })
    .strict()

export type HookRequestEnvelope = z.infer<typeof HookRequestEnvelopeSchema>
