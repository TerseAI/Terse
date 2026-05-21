import { Request, Response } from "express"

import logger from "../../../common/logger"
import { parsePageParams } from "../../../common/pagination"

import { listSentNotificationsForOrganization } from "./service"

export async function getSentNotifications(req: Request, res: Response) {
    try {
        const user = req.session?.user
        if (!user) return res.status(401).json({ error: "Unauthorized" })
        const organizationId = user.organizationId
        if (!organizationId) return res.status(400).json({ error: "Organization context is required" })

        const { page, pageSize, skip, take } = parsePageParams(req, 12, 100)
        const response = await listSentNotificationsForOrganization(organizationId, page, pageSize, skip, take)
        res.status(200).json(response)
    } catch (error) {
        logger.error("[SentNotifications] Failed to fetch sent notifications", {
            error,
            userId: req.session?.user?.id
        })
        res.status(500).json({ error: "Failed to fetch sent notifications" })
    }
}
