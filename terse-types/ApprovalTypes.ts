import * as z from "zod"

import { integrationTypeEnum } from "./Integrations"

export const approvalActionTypeSchema = z.enum(["open_run_history", "approve_action", "reject_action"])
export type ApprovalActionType = z.infer<typeof approvalActionTypeSchema>

export const approvalRequestStatusSchema = z.enum(["pending", "in_progress", "completed"])
export type ApprovalRequestStatus = z.infer<typeof approvalRequestStatusSchema>

export type ApprovalRequestFilter = ApprovalRequestStatus | "all"

export const approvalActionSchema = z.object({
    type: approvalActionTypeSchema,
    label: z.string(),
    deepLink: z.string()
})
export type ApprovalAction = z.infer<typeof approvalActionSchema>

export const approvalRequestSchema = z.object({
    id: z.string(),
    icon: integrationTypeEnum,
    title: z.string(),
    subheader: z.string(),
    timestamp: z.string(),
    status: approvalRequestStatusSchema,
    actions: z.array(approvalActionSchema),
    runId: z.string(),
    agentId: z.string()
})
export type ApprovalRequest = z.infer<typeof approvalRequestSchema>

export type GetPendingApprovalsResponse = {
    items: ApprovalRequest[]
}

export function parseDeepLink(deepLink: string): { type: string; params: string[] } {
    const parts = deepLink.split("|")
    return { type: parts[0], params: parts.slice(1) }
}

export function encodeDeepLink(type: ApprovalActionType, ...params: string[]): string {
    return [type, ...params].join("|")
}
