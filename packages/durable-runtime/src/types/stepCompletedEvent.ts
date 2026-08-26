import { z } from "zod"

export const StepCompletedEventSchema = z
    .object({
        eventId: z.string(),
        type: z.literal("step.completed"),
        stepId: z.string(),
        name: z.string().min(1),
        completedAt: z.iso.datetime(),
        output: z.json()
    })
    .strict()

export type StepCompletedEvent = z.infer<typeof StepCompletedEventSchema>
