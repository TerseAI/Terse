import { z } from "zod"

import { HookRequestEnvelopeSchema } from "./hookRequestEnvelope.js"

export const SuspensionSchema = z
    .object({
        waitId: z.string(),
        request: HookRequestEnvelopeSchema
    })
    .strict()

export type Suspension = z.infer<typeof SuspensionSchema>

export const RuntimeCompletedOutcomeSchema = z
    .object({
        status: z.literal("completed")
    })
    .strict()

export type RuntimeCompletedOutcome = z.infer<typeof RuntimeCompletedOutcomeSchema>

export const RuntimeSuspendedOutcomeSchema = z
    .object({
        status: z.literal("suspended"),
        suspension: SuspensionSchema
    })
    .strict()

export type RuntimeSuspendedOutcome = z.infer<typeof RuntimeSuspendedOutcomeSchema>

export const RuntimeOutcomeSchema = z.discriminatedUnion("status", [RuntimeCompletedOutcomeSchema, RuntimeSuspendedOutcomeSchema])

export type RuntimeOutcome = z.infer<typeof RuntimeOutcomeSchema>
