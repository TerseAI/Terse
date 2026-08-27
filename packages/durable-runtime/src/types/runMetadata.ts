import { z } from "zod"

export const RunMetadataSchema = z
    .object({
        runId: z.string().min(1),
        workflowName: z.string().min(1),
        startedAt: z.iso.datetime()
    })
    .strict()

export type RunMetadata = z.infer<typeof RunMetadataSchema>
