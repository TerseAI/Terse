import { IntegrationType as PrismaIntegrationType, RunHistoryStatus as PrismaRunHistoryStatus } from "@prisma/client"
import { ApprovalRequest, ApprovalRequestFilter, ApprovalRequestStatus, encodeDeepLink } from "terse-types/ApprovalTypes"

import logger from "../../common/logger"
import { convertPrismaIntegrationTypeToIntegrationTypeFromRunHistory } from "../../common/typeConverters"

import { ApprovalFilter, fetchApprovalRows } from "./repository"

const VALID_FILTERS: ApprovalRequestFilter[] = ["all", "pending", "in_progress", "completed"]

export function parseApprovalFilter(queryValue: unknown): ApprovalFilter {
    if (typeof queryValue !== "string") return "all"
    const normalized = queryValue.trim() as ApprovalRequestFilter
    return VALID_FILTERS.includes(normalized) ? (normalized as ApprovalFilter) : "all"
}

function extractStepId(interruptions: unknown): string | null {
    if (!Array.isArray(interruptions)) return null
    for (const interruption of interruptions) {
        const callId = (interruption as { rawItem?: { callId?: unknown } })?.rawItem?.callId
        if (typeof callId === "string" && callId.trim().length > 0) {
            return callId
        }
    }
    return null
}

function mapRunStatusToApprovalStatus(status: PrismaRunHistoryStatus): ApprovalRequestStatus {
    switch (status) {
        case PrismaRunHistoryStatus.awaiting_approval:
            return "pending"
        case PrismaRunHistoryStatus.in_progress:
        case PrismaRunHistoryStatus.suspended:
            return "in_progress"
        case PrismaRunHistoryStatus.success:
        case PrismaRunHistoryStatus.failed:
        case PrismaRunHistoryStatus.skipped:
        case PrismaRunHistoryStatus.cancelled:
            return "completed"
        default:
            throw status satisfies never
    }
}

function toApprovalRequest(row: {
    id: string
    automation_id: string
    status: PrismaRunHistoryStatus
    event: string
    trigger_integration: PrismaIntegrationType
    trigger_title: string | null
    trigger_subheader: string | null
    timestamp: Date
    automation: { id: string; name: string }
    pending_approval: { interruptions: unknown } | null
}): ApprovalRequest | null {
    const title = row.trigger_title || row.event
    const subheader = row.trigger_subheader || row.automation.name
    const status = mapRunStatusToApprovalStatus(row.status)
    const stepId = extractStepId(row.pending_approval?.interruptions)
    const hasPendingStepId = Boolean(stepId)

    return {
        id: row.id,
        icon: convertPrismaIntegrationTypeToIntegrationTypeFromRunHistory(row.trigger_integration),
        title,
        subheader,
        timestamp: row.timestamp.toISOString(),
        status,
        actions:
            status === "pending" && hasPendingStepId
                ? [
                      { type: "open_run_history", label: "Open run", deepLink: encodeDeepLink("open_run_history", row.automation_id, row.id) },
                      { type: "approve_action", label: "Approve", deepLink: encodeDeepLink("approve_action", row.id, stepId!) },
                      { type: "reject_action", label: "Reject", deepLink: encodeDeepLink("reject_action", row.id, stepId!) }
                  ]
                : [{ type: "open_run_history", label: "Open run", deepLink: encodeDeepLink("open_run_history", row.automation_id, row.id) }],
        runId: row.id,
        agentId: row.automation_id
    }
}

export async function listPendingApprovals(organizationId: string, filter: ApprovalFilter): Promise<ApprovalRequest[]> {
    const rows = await fetchApprovalRows(organizationId, filter)
    const items: ApprovalRequest[] = []
    for (const row of rows) {
        const approvalRequest = toApprovalRequest(row)
        if (!approvalRequest || (approvalRequest.status === "pending" && approvalRequest.actions.length === 1)) {
            logger.warn("[PendingApprovals] Could not extract stepId from pending approval interruption", {
                runId: row.id,
                organizationId
            })
            continue
        }
        items.push(approvalRequest)
    }
    return items
}
