import { Request, Response } from "express"
import { GetPendingApprovalsResponse } from "terse-types/ApprovalTypes"

import logger from "../../common/logger"
import { listPendingApprovals, parseApprovalFilter } from "./service"

export async function getPendingApprovals(req: Request, res: Response) {
    try {
        const user = req.session?.user
        if (!user) return res.status(401).json({ error: "Unauthorized" })
        const organizationId = user.organizationId
        if (!organizationId) return res.status(400).json({ error: "Organization context is required" })

        const filter = parseApprovalFilter(req.query.status)
        const items = await listPendingApprovals(organizationId, filter)
        const response: GetPendingApprovalsResponse = { items }
        return res.status(200).json(response)
    } catch (error) {
        logger.error("[PendingApprovals] Failed to fetch pending approvals", {
            error,
            userId: req.session?.user?.id
        })
        return res.status(500).json({ error: "Failed to fetch pending approvals" })
    }
}
