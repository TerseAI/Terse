import { z } from "zod"

export const WaitEventTypeSchema = z.enum(["wait.requested", "wait.resolved"])

export type WaitEventType = z.infer<typeof WaitEventTypeSchema>
