import { z } from "zod"

export const WaitEventTypeSchema = z.enum(["wait.requested"])

export type WaitEventType = z.infer<typeof WaitEventTypeSchema>
