import { Request, Response } from "express"
import { UpdateNotificationSettingsRequest } from "terse-types/Notifications"

import logger from "../../../common/logger"

import { ApplyToAllAgentsForbiddenError, NotificationSettingsNotFoundError, getNotificationSettingsForUser, updateNotificationSettingsForUser } from "./service"

export async function getNotificationSettings(req: Request, res: Response) {
    if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" })
    const userId = req.session.user.id
    try {
        const response = await getNotificationSettingsForUser(userId)
        res.status(200).json(response)
    } catch (error) {
        if (error instanceof NotificationSettingsNotFoundError) return res.status(404).json({ error: error.message })
        logger.error("Error fetching notification settings", { error, userId })
        res.status(500).json({ error: "Failed to fetch notification settings" })
    }
}

export async function updateNotificationSettings(req: Request, res: Response) {
    if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" })
    const userId = req.session.user.id
    const organizationId = req.session.user.organizationId
    const isAdmin = req.session.user.roles.includes("admin")

    try {
        const response = await updateNotificationSettingsForUser({
            userId,
            organizationId,
            isAdmin,
            body: req.body as UpdateNotificationSettingsRequest
        })
        res.status(200).json(response)
    } catch (error) {
        if (error instanceof NotificationSettingsNotFoundError) return res.status(404).json({ error: error.message })
        if (error instanceof ApplyToAllAgentsForbiddenError) return res.status(403).json({ error: error.message })
        if (error instanceof Error && error.message.includes("Organization context")) {
            return res.status(400).json({ error: error.message })
        }
        logger.error("Error updating notification settings", { error, userId, organizationId })
        res.status(500).json({ error: "Failed to update notification settings" })
    }
}
