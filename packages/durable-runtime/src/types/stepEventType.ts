import { z } from "zod"

export const StepEventTypeSchema = z.enum(["step.started", "step.completed", "step.failed"])

export type StepEventType = z.infer<typeof StepEventTypeSchema>
