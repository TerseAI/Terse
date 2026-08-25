import { z } from "zod"

export const StepStartedEventSchema = z
    .object({
        eventId: z.string(),
        type: z.literal("step.started"),
        stepId: z.string(),
        name: z.string().min(1),
        startedAt: z.iso.datetime(),
        input: z.json()
    })
    .strict()

export type StepStartedEvent = z.infer<typeof StepStartedEventSchema>
