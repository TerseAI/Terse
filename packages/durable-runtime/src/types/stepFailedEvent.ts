import { z } from "zod"

export const StepFailedEventSchema = z
    .object({
        eventId: z.string(),
        type: z.literal("step.failed"),
        stepId: z.string(),
        name: z.string().min(1),
        failedAt: z.iso.datetime(),
        error: z
            .object({
                name: z.string(),
                message: z.string()
            })
            .strict()
    })
    .strict()

export type StepFailedEvent = z.infer<typeof StepFailedEventSchema>
