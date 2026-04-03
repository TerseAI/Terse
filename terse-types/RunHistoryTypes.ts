import * as z from "zod"

import { ConfigType, configTypeEnum } from "./Configs"
import { IntegrationType, integrationTypeEnum } from "./Integrations"
import type { ModelEvent } from "./ModelEvents"
import type { User } from "./types"

export enum RunHistoryStatus {
    SUCCESS = "success",
    FAILED = "failed",
    CANCELLED = "cancelled",
    SKIPPED = "skipped",
    IN_PROGRESS = "in_progress",
    AWAITING_APPROVAL = "awaiting_approval"
}

export type RunHistoryDecisionAction = "processed" | "skipped"
export const RUN_HISTORY_ACTION_TYPES = ["create", "update", "delete", "read", "approve", "error"] as const
export type RunHistoryActionType = (typeof RUN_HISTORY_ACTION_TYPES)[number]

export const runHistoryActionBaseSchema = z.object({
    action: z.string(),
    integration: integrationTypeEnum,
    target: z.string(),
    details: z.string(),
    url: z.string().optional(),
    step_id: z.string().optional(),
    type: z.enum(RUN_HISTORY_ACTION_TYPES),
    isReadOnly: z.boolean().optional(),
    output_items: z
        .array(
            z.object({
                output_item_id: z.string(),
                output_item_type: configTypeEnum
            })
        )
        .optional()
})

export type RunHistoryAction = z.infer<typeof runHistoryActionBaseSchema>

export type RunHistoryActionWithId = RunHistoryAction & {
    id: string
}

export type RunHistoryTrigger = {
    // What event occurred to trigger the run (free-text, e.g. "email received", "database row created")
    event: string
    // Which integration this trigger came from (used for icons and grouping)
    integration: IntegrationType
    // Source or context of the trigger (e.g. Gmail, Notion DB name, repo name)
    source: string
    // Title of the trigger (Subject of the email, name of the database, etc.)
    title?: string
    // Subheader of the trigger (From of the email, description of the database, etc.)
    subheader?: string
    // Link to the trigger (Email URL, Database URL, etc.)
    url?: string
}

export type RunHistoryDecision = {
    action: RunHistoryDecisionAction
    reasoning: string
}

export type RunHistoryRecord = {
    id: string
    agentId: string
    timestamp: string
    trigger: RunHistoryTrigger
    filtered: boolean
    decision: RunHistoryDecision
    actions?: RunHistoryAction[]
    status: RunHistoryStatus
    isManuallyTriggered: boolean
}

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

export type RunHistoryRecordWithAgent = RunHistoryRecord & {
    agentName: string
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
