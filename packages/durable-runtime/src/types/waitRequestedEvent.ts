import { z } from "zod"

export const WaitRequestedEventSchema = z
    .object({
        eventId: z.string(),
        type: z.literal("wait.requested"),
        waitId: z.string(),
        requestedAt: z.iso.datetime(),
        request: z.json()
    })
    .strict()

export type WaitRequestedEvent = z.infer<typeof WaitRequestedEventSchema>
