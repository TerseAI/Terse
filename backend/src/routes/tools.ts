import { Request, Response } from "express"

import logger from "../logger"
import type { GetToolsThatRequireApprovalsRequest, GetToolsThatRequireApprovalsResponse } from "../shared/ToolsTypes"
import { getToolsThatRequireApprovals } from "../tools/availableTools"

export async function toolsThatRequireApprovalsRoute(req: Request, res: Response) {
    try {
        const user = req.session?.user
        if (!user) {
            return res.status(401).json({ error: "Unauthorized" })
        }

        const body = req.body as GetToolsThatRequireApprovalsRequest

        if (!Array.isArray(body.skills)) {
            return res.status(400).json({
                error: "Invalid request",
                message: "skills must be an array"
            })
        }

        const knowledgeBases = Array.isArray(body.knowledgeBases) ? body.knowledgeBases : []

        const tools = getToolsThatRequireApprovals(body.skills, knowledgeBases)
        const response: GetToolsThatRequireApprovalsResponse = { tools }
        return res.status(200).json(response)
    } catch (error: unknown) {
        logger.error("Error fetching tools that require approvals:", { error })
        return res.status(500).json({
            error: "Failed to fetch tools that require approvals"
        })
    }
}
