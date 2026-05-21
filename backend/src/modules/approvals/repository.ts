import { RunHistoryStatus as PrismaRunHistoryStatus } from "@prisma/client"

import { db } from "../../loaders/prisma"

const MAX_APPROVALS = 100

const COMPLETED_STATUSES = [PrismaRunHistoryStatus.success, PrismaRunHistoryStatus.failed, PrismaRunHistoryStatus.skipped, PrismaRunHistoryStatus.cancelled]

export type ApprovalFilter = "all" | "pending" | "in_progress" | "completed"

export async function fetchApprovalRows(organizationId: string, filter: ApprovalFilter) {
    const orgFilter = { automation: { organization_id: organizationId } }
    let where
    switch (filter) {
        case "pending":
            where = { ...orgFilter, status: PrismaRunHistoryStatus.awaiting_approval }
            break
        case "in_progress":
            where = { ...orgFilter, has_approval_request: true, status: PrismaRunHistoryStatus.in_progress }
            break
        case "completed":
            where = { ...orgFilter, has_approval_request: true, status: { in: COMPLETED_STATUSES } }
            break
        default:
            where = { ...orgFilter, OR: [{ status: PrismaRunHistoryStatus.awaiting_approval }, { has_approval_request: true }] }
    }

    return db().run_history_records.findMany({
        where,
        orderBy: { timestamp: "desc" },
        include: {
            automation: { select: { id: true, name: true } },
            pending_approval: { select: { interruptions: true } }
        },
        take: MAX_APPROVALS
    })
}
