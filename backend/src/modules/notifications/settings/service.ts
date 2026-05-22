import { notificationSettingsKey } from "terse-types/InvalidationKeys"
import { NotificationSettings, UpdateNotificationSettingsRequest } from "terse-types/Notifications"
import { RUN_HISTORY_ACTION_TYPES, RunHistoryActionType } from "terse-types/RunHistoryTypes"
import { z } from "zod"

import logger from "../../../common/logger"
import { emitCacheInvalidationWithKey, emitCacheInvalidationWithWildcard } from "../../../services/CacheInvalidationService"
import { UserNotificationSettings } from "../../../types/prisma"

import { applySettingsToAllAgentsInOrganization, findUserNotificationSettings, updateUserNotificationSettings } from "./repository"

const NOTIFICATION_SETTINGS_INVALIDATION_KEY = notificationSettingsKey()[0]

export const updateNotificationSettingsSchema = z.object({
    agentDefaultNotifications: z.array(z.enum(RUN_HISTORY_ACTION_TYPES)),
    weeklyAgentImprovements: z.boolean(),
    applyToAllAgents: z.boolean().optional()
})

export class NotificationSettingsNotFoundError extends Error {
    constructor() {
        super("Notification settings not found")
        this.name = "NotificationSettingsNotFoundError"
    }
}

export class ApplyToAllAgentsForbiddenError extends Error {
    constructor() {
        super("Only organization admins can apply notification settings to all agents")
        this.name = "ApplyToAllAgentsForbiddenError"
    }
}

function transformUserSettingsToFrontendFormat(userSettings: UserNotificationSettings): NotificationSettings {
    return {
        id: userSettings.id,
        agentDefaultNotifications: userSettings.agent_default_notifications as RunHistoryActionType[],
        weeklyAgentImprovements: userSettings.weekly_agent_improvements
    }
}

export async function getNotificationSettingsForUser(userId: string): Promise<NotificationSettings> {
    const userSettings = await findUserNotificationSettings(userId)
    if (!userSettings) throw new NotificationSettingsNotFoundError()
    return transformUserSettingsToFrontendFormat(userSettings)
}

interface UpdateSettingsInput {
    userId: string
    organizationId: string | undefined
    isAdmin: boolean
    body: UpdateNotificationSettingsRequest
}

function invalidateNotificationSettings(organizationId: string | undefined, updatedAgentIds: string[], applyToAllAgents: boolean): void {
    if (!organizationId) return
    emitCacheInvalidationWithKey(organizationId, NOTIFICATION_SETTINGS_INVALIDATION_KEY)
    if (!applyToAllAgents) return
    emitCacheInvalidationWithKey(organizationId, "agents")
    emitCacheInvalidationWithKey(organizationId, "recentAgents")
    for (const agentId of updatedAgentIds) {
        emitCacheInvalidationWithWildcard(organizationId, "agent", agentId)
    }
}

export async function updateNotificationSettingsForUser(input: UpdateSettingsInput): Promise<NotificationSettings> {
    const { userId, organizationId, isAdmin, body } = input
    const parsed = updateNotificationSettingsSchema.parse(body)
    const { agentDefaultNotifications, weeklyAgentImprovements, applyToAllAgents = false } = parsed

    if (applyToAllAgents && !organizationId) {
        throw new Error("Organization context is required to apply settings to all agents")
    }
    if (applyToAllAgents && !isAdmin) {
        logger.warn("🚫 applyToAllAgents blocked: requester is not an org admin", { userId, organizationId })
        throw new ApplyToAllAgentsForbiddenError()
    }

    const existing = await findUserNotificationSettings(userId)
    if (!existing) throw new NotificationSettingsNotFoundError()

    const updatedSettings = await updateUserNotificationSettings(userId, {
        agent_default_notifications: agentDefaultNotifications,
        weekly_agent_improvements: weeklyAgentImprovements
    })

    let updatedAgentIds: string[] = []
    if (applyToAllAgents && organizationId) {
        const targetEnabled = agentDefaultNotifications.length > 0
        updatedAgentIds = await applySettingsToAllAgentsInOrganization(organizationId, agentDefaultNotifications, targetEnabled)
    }

    invalidateNotificationSettings(organizationId, updatedAgentIds, applyToAllAgents)
    return transformUserSettingsToFrontendFormat(updatedSettings)
}
