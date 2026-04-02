import { Request, Response } from "express"
import { notificationSettingsKey } from "terse-types/InvalidationKeys"
import { NotificationSettings, UpdateNotificationSettingsRequest } from "terse-types/Notifications"
import { RUN_HISTORY_ACTION_TYPES, RunHistoryActionType } from "terse-types/RunHistoryTypes"
import { z } from "zod"

import logger from "../logger"
import { db } from "../prismaClient"
import { emitCacheInvalidationWithKey, emitCacheInvalidationWithWildcard } from "../services/CacheInvalidationService"
import { UserNotificationSettings } from "../types/prisma"

const NOTIFICATION_SETTINGS_INVALIDATION_KEY = notificationSettingsKey()[0]

const updateNotificationSettingsSchema = z.object({
    agentDefaultNotifications: z.array(z.enum(RUN_HISTORY_ACTION_TYPES)),
    weeklyAgentImprovements: z.boolean(),
    applyToAllAgents: z.boolean().optional()
})

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
    const organizationId = req.session.user.organizationId

    const parsedBody = updateNotificationSettingsSchema.safeParse(req.body as UpdateNotificationSettingsRequest)
    if (!parsedBody.success) {
        res.status(400).json({ error: "Invalid request body" })
        return
    }

    const { agentDefaultNotifications, weeklyAgentImprovements, applyToAllAgents = false } = parsedBody.data
    if (applyToAllAgents && !organizationId) {
        res.status(400).json({ error: "Organization context is required to apply settings to all agents" })
        return
    }

    try {
        const prisma = db()

        const { updatedSettings, updatedAgentIds } = await prisma.$transaction(async tx => {
            const existingSettings = await tx.user_notification_settings.findUnique({
                where: {
                    user_id: userId
                }
            })
            if (!existingSettings) {
                throw new Error(`Could not find matching notification settings for user: ${userId}`)
            }

            const updatedSettings = await tx.user_notification_settings.update({
                where: {
                    user_id: userId
                },
                data: {
                    agent_default_notifications: agentDefaultNotifications,
                    weekly_agent_improvements: weeklyAgentImprovements
                }
            })

            if (!applyToAllAgents || !organizationId) {
                return {
                    updatedSettings,
                    updatedAgentIds: [] as string[]
                }
            }

            const targetEnabled = agentDefaultNotifications.length > 0
            const orgAgents = await tx.automations.findMany({
                where: {
                    organization_id: organizationId
                },
                select: {
                    id: true
                }
            })

            const updatedAgentIds = orgAgents.map(agent => agent.id)
            if (updatedAgentIds.length === 0) {
                return { updatedSettings, updatedAgentIds }
            }

            await tx.automation_notification_settings.updateMany({
                where: {
                    automation_id: {
                        in: updatedAgentIds
                    }
                },
                data: {
                    enabled: targetEnabled,
                    action_types: agentDefaultNotifications
                }
            })

            const existingAutomationSettings = await tx.automation_notification_settings.findMany({
                where: {
                    automation_id: {
                        in: updatedAgentIds
                    }
                },
                select: {
                    automation_id: true
                }
            })

            const existingAutomationIds = new Set(existingAutomationSettings.map(setting => setting.automation_id))
            const missingAutomationIds = updatedAgentIds.filter(agentId => !existingAutomationIds.has(agentId))

            if (missingAutomationIds.length > 0) {
                await tx.automation_notification_settings.createMany({
                    data: missingAutomationIds.map(automationId => ({
                        automation_id: automationId,
                        enabled: targetEnabled,
                        action_types: agentDefaultNotifications
                    }))
                })
            }

            return { updatedSettings, updatedAgentIds }
        })

        invalidateNotificationSettings(organizationId, updatedAgentIds, applyToAllAgents)

        const response = transformUserSettingsToFrontendFormat(updatedSettings)
        res.status(200).json(response)
    } catch (error) {
        logger.error("Error updating notification settings", { error, userId, organizationId, applyToAllAgents })
        res.status(500).json({ error: "Failed to update notification settings" })
    }
}

function invalidateNotificationSettings(organizationId: string | undefined, updatedAgentIds: string[], applyToAllAgents: boolean): void {
    if (!organizationId) {
        return
    }

    emitCacheInvalidationWithKey(organizationId, NOTIFICATION_SETTINGS_INVALIDATION_KEY)
    if (!applyToAllAgents) {
        return
    }

    emitCacheInvalidationWithKey(organizationId, "agents")
    emitCacheInvalidationWithKey(organizationId, "recentAgents")
    for (const agentId of updatedAgentIds) {
        emitCacheInvalidationWithWildcard(organizationId, "agent", agentId)
    }
}
