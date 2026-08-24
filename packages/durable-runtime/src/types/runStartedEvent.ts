import { z } from "zod"

export const RunStartedEventSchema = z
    .object({
        type: z.literal("run.started"),
        workflowName: z.string().min(1),
        startedAt: z.iso.datetime(),
        input: z.json()
    })
    .strict()

export type RunStartedEvent = z.infer<typeof RunStartedEventSchema>
