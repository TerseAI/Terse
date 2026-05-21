import { Request, Response } from "express"
import type { GetToolsThatRequireApprovalsResponse } from "terse-types/ToolsTypes"
import { getToolsThatRequireApprovalsRequestSchema } from "terse-types/ToolsTypes"

import logger from "../../common/logger"
import { getToolsThatRequireApprovals } from "../../tools/availableTools"

export async function toolsThatRequireApprovalsRoute(req: Request, res: Response) {
    try {
        const user = req.session?.user
        if (!user) return res.status(401).json({ error: "Unauthorized" })

        const { skills } = getToolsThatRequireApprovalsRequestSchema.parse(req.body)
        const tools = getToolsThatRequireApprovals(skills)
        const response: GetToolsThatRequireApprovalsResponse = { tools }
        res.status(200).json(response)
    } catch (error: unknown) {
        logger.error("Error fetching tools that require approvals:", { error })
        res.status(500).json({ error: "Failed to fetch tools that require approvals" })
    }
}
