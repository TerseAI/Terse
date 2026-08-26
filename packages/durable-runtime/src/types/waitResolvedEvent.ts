import { z } from "zod"

export const WaitResolvedEventSchema = z
    .object({
        eventId: z.string(),
        type: z.literal("wait.resolved"),
        waitId: z.string(),
        resolvedAt: z.iso.datetime(),
        payload: z.json()
    })
    .strict()

export type WaitResolvedEvent = z.infer<typeof WaitResolvedEventSchema>
