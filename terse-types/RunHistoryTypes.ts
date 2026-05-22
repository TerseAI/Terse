import * as z from "zod"

import { configTypeEnum } from "./Configs"
import { integrationTypeEnum } from "./Integrations"
import type { ModelEvent } from "./ModelEvents"
import type { RunHistoryRecord, RunHistoryRecordWithAgent, User } from "./types"

export const RunHistoryStatus = {
    SUCCESS: "success",
    FAILED: "failed",
    CANCELLED: "cancelled",
    SKIPPED: "skipped",
    IN_PROGRESS: "in_progress",
    AWAITING_APPROVAL: "awaiting_approval"
} as const
export const runHistoryStatusSchema = z.enum(RunHistoryStatus)
export type RunHistoryStatus = z.infer<typeof runHistoryStatusSchema>

export const runHistoryDecisionActionSchema = z.enum(["processed", "skipped"])
export type RunHistoryDecisionAction = z.infer<typeof runHistoryDecisionActionSchema>

export const RUN_HISTORY_ACTION_TYPES = ["create", "update", "delete", "read", "approve", "error"] as const
export const runHistoryActionTypeSchema = z.enum(RUN_HISTORY_ACTION_TYPES)
export type RunHistoryActionType = z.infer<typeof runHistoryActionTypeSchema>

export const outputItemSchema = z.object({
    output_item_id: z.string(),
    output_item_type: configTypeEnum
})
export type OutputItem = z.infer<typeof outputItemSchema>

export const runHistoryActionBaseSchema = z.object({
    action: z.string(),
    integration: integrationTypeEnum,
    target: z.string(),
    details: z.string(),
    url: z.string().optional(),
    step_id: z.string().optional(),
    type: runHistoryActionTypeSchema,
    isReadOnly: z.boolean().optional(),
    output_items: z.array(outputItemSchema).optional()
})

export type RunHistoryAction = z.infer<typeof runHistoryActionBaseSchema>

export type RunHistoryActionWithId = RunHistoryAction & {
    id: string
}

// RunHistoryTrigger, RunHistoryDecision, RunHistoryRecord, RunHistoryRecordWithAgent
// are now defined as Zod schemas in types.ts and re-exported via index.ts.
// Re-export them here for backward compatibility.
export type { RunHistoryTrigger, RunHistoryDecision, RunHistoryRecord, RunHistoryRecordWithAgent } from "./types"

export type GetRunHistoryParamsRequest = {
    agentId: string
}

export type GetRunHistoryParams = {
    q?: string
    start?: string // ISO date string
    end?: string // ISO date string
    status?: RunHistoryStatus[]
    page?: number
    pageSize?: number
}

export type GetRunHistoryResponse = {
    items: RunHistoryRecord[]
    page: number
    pageSize: number
    total: number
}

export type GetAllRunHistoryResponse = {
    items: RunHistoryRecordWithAgent[]
    page: number
    pageSize: number
    total: number
}

export type RunHistoryModelEvent = ModelEvent & { id: string }

export type RunHistoryModelSocketEvent = {
    runId: string
    agentId: string
    runHistoryModelEvent: RunHistoryModelEvent
}

export type TrackingParams = {
    runId: string
    agentId: string
    user: User
}
