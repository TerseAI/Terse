import { Request, Response } from "express"

import logger from "../logger"
import { db } from "../prismaClient"
import { NotificationSettings } from "../shared/Notifications"
import { RunHistoryActionType } from "../shared/RunHistoryTypes"
import { UserNotificationSettings } from "../types/prisma"

export async function getNotificationSettings(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: "Unauthorized" })
        return
    }
    const userId = req.session.user.id

    try {
        const userSettings = await db().user_notification_settings.findUnique({
            where: {
                user_id: userId
            }
        })

        if (!userSettings) {
            throw new Error(`Could not find user notification settings for: ${userId}`)
        }

        const response = transformUserSettingsToFrontendFormat(userSettings)
        res.status(200).json(response)
    } catch (error) {
        logger.error("Error fetching notification settings", { error, userId })
        res.status(500).json({ error: "Failed to fetch notification settings" })
    }
}

function transformUserSettingsToFrontendFormat(userSettings: UserNotificationSettings): NotificationSettings {
    return {
        id: userSettings.id,
        agentDefaultNotifications: userSettings.agent_default_notifications as RunHistoryActionType[],
        weeklyAgentImprovements: userSettings.weekly_agent_improvements
    }
}

export async function updateNotificationSettings(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: "Unauthorized" })
        return
    }
    const userId = req.session.user.id
    const requestBody = req.body as NotificationSettings
    const { id, agentDefaultNotifications, weeklyAgentImprovements } = requestBody

    try {
        const prisma = db()
        const existingSettings = await prisma.user_notification_settings.findUnique({
            where: {
                id: id,
                user_id: userId
            }
        })
        if (!existingSettings) {
            throw new Error(`Could not find matching notification settings: ${id} for user: ${userId}`)
        }

        const updatedSettings = await prisma.user_notification_settings.update({
            where: {
                id: id,
                user_id: userId
            },
            data: {
                agent_default_notifications: agentDefaultNotifications,
                weekly_agent_improvements: weeklyAgentImprovements
            }
        })

        const response = transformUserSettingsToFrontendFormat(updatedSettings)
        res.status(200).json(response)
    } catch (error) {
        logger.error("Error updating notification settings", { error, userId })
        res.status(500).json({ error: "Failed to update notification settings" })
    }
}
