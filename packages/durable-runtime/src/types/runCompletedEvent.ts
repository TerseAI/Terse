import { z } from "zod"

export const RunCompletedEventSchema = z
    .object({
        eventId: z.literal("run.completed"),
        type: z.literal("run.completed"),
        completedAt: z.iso.datetime()
    })
    .strict()

export type RunCompletedEvent = z.infer<typeof RunCompletedEventSchema>
