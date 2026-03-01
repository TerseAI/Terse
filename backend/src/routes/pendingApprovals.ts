import { Prisma, IntegrationType as PrismaIntegrationType, RunHistoryStatus as PrismaRunHistoryStatus } from "@prisma/client"
import { Request, Response } from "express"

import logger from "../logger"
import { db } from "../prismaClient"
import { ApprovalRequest, ApprovalRequestFilter, ApprovalRequestStatus, GetPendingApprovalsResponse, encodeDeepLink } from "../shared/ApprovalTypes"
import { convertPrismaIntegrationTypeToIntegrationTypeFromRunHistory } from "../utility/typeConverters"

const MAX_APPROVALS = 100
const VALID_FILTERS: ApprovalRequestFilter[] = ["all", "pending", "in_progress", "completed"]

function extractStepId(interruptions: unknown): string | null {
    if (!Array.isArray(interruptions)) {
        return null
    }

    for (const interruption of interruptions) {
        const callId = (interruption as any)?.rawItem?.callId
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
            return "in_progress"
        case PrismaRunHistoryStatus.success:
        case PrismaRunHistoryStatus.failed:
        case PrismaRunHistoryStatus.skipped:
            return "completed"
        default:
            throw status satisfies never
    }
}

function parseApprovalFilter(queryValue: unknown): ApprovalRequestFilter {
    if (typeof queryValue !== "string") {
        return "all"
    }

    const normalized = queryValue.trim() as ApprovalRequestFilter
    return VALID_FILTERS.includes(normalized) ? normalized : "all"
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
                      {
                          type: "open_run_history",
                          label: "Open run",
                          deepLink: encodeDeepLink("open_run_history", row.automation_id, row.id),
                          variant: "outline"
                      },
                      {
                          type: "approve_action",
                          label: "Approve",
                          deepLink: encodeDeepLink("approve_action", row.id, stepId!),
                          variant: "primary"
                      },
                      {
                          type: "reject_action",
                          label: "Reject",
                          deepLink: encodeDeepLink("reject_action", row.id, stepId!),
                          variant: "destructive"
                      }
                  ]
                : [
                      {
                          type: "open_run_history",
                          label: "Open run",
                          deepLink: encodeDeepLink("open_run_history", row.automation_id, row.id),
                          variant: "outline"
                      }
                  ],
        runId: row.id,
        agentId: row.automation_id
    }
}

export async function getPendingApprovals(req: Request, res: Response) {
    try {
        const user = req.session?.user
        if (!user) {
            return res.status(401).json({ error: "Unauthorized" })
        }

        const organizationId = user.organizationId
        if (!organizationId) {
            return res.status(400).json({ error: "Organization context is required" })
        }

        const filter = parseApprovalFilter(req.query.status)
        const prisma = db()

        const historicalApprovalRunIds = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
            SELECT rhr.id
            FROM run_history_records rhr
            INNER JOIN automations a ON a.id = rhr.automation_id
            INNER JOIN run_history_raw_events rhre ON rhre.run_history_record_id = rhr.id
            WHERE a.organization_id = ${organizationId}
              AND (
                  (rhre.raw_event_json->>'id') LIKE 'msg_tool_approval_request-%'
                  OR rhre.raw_event_json::text LIKE '%msg_tool_approval_request-%'
              )
            GROUP BY rhr.id, rhr.timestamp
            ORDER BY rhr.timestamp DESC
            LIMIT ${MAX_APPROVALS}
        `)
        const approvalRunIds = historicalApprovalRunIds.map(record => record.id)

        const rows = await prisma.run_history_records.findMany({
            where: {
                automation: {
                    organization_id: organizationId
                },
                OR: [
                    {
                        status: PrismaRunHistoryStatus.awaiting_approval
                    },
                    ...(approvalRunIds.length > 0
                        ? [
                              {
                                  id: { in: approvalRunIds }
                              }
                          ]
                        : [])
                ]
            },
            orderBy: {
                timestamp: "desc"
            },
            include: {
                automation: {
                    select: {
                        id: true,
                        name: true
                    }
                },
                pending_approval: {
                    select: {
                        interruptions: true
                    }
                }
            },
            take: MAX_APPROVALS
        })

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

        const filteredItems = filter === "all" ? items : items.filter(item => item.status === filter)
        const response: GetPendingApprovalsResponse = { items: filteredItems }
        return res.status(200).json(response)
    } catch (error) {
        logger.error("[PendingApprovals] Failed to fetch pending approvals", {
            error,
            userId: req.session?.user?.id
        })
        return res.status(500).json({ error: "Failed to fetch pending approvals" })
    }
}
