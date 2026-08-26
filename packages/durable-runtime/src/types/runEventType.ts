import { z } from "zod"

export const RunEventTypeSchema = z.enum(["run.started", "run.completed"])

export type RunEventType = z.infer<typeof RunEventTypeSchema>
