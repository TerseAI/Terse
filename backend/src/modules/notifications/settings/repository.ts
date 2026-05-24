import { RunHistoryActionType } from "terse-types/RunHistoryTypes"

import { db } from "../../../loaders/prisma"
import { UserNotificationSettings } from "../../../types/prisma"

export const DEFAULT_AGENT_NOTIFICATIONS: RunHistoryActionType[] = ["error"]
export const DEFAULT_WEEKLY_AGENT_IMPROVEMENTS = true

/**
 * Returns the user's notification settings, or the static defaults if no row
 * exists. The row is only written when the user explicitly customizes something
 * (see updateUserNotificationSettings).
 */
export async function getUserNotificationSettings(userId: string): Promise<UserNotificationSettings> {
    const row = await db().user_notification_settings.findUnique({ where: { user_id: userId } })
    if (row) return row
    const now = new Date()
    return {
        id: "",
        user_id: userId,
        agent_default_notifications: DEFAULT_AGENT_NOTIFICATIONS,
        weekly_agent_improvements: DEFAULT_WEEKLY_AGENT_IMPROVEMENTS,
        created_at: now,
        updated_at: now
    }
}

export async function updateUserNotificationSettings(
    userId: string,
    data: { agent_default_notifications: RunHistoryActionType[]; weekly_agent_improvements: boolean }
): Promise<UserNotificationSettings> {
    return db().user_notification_settings.upsert({
        where: { user_id: userId },
        create: { user_id: userId, ...data },
        update: data
    })
}

export async function applySettingsToAllAgentsInOrganization(organizationId: string, agentDefaultNotifications: RunHistoryActionType[], targetEnabled: boolean): Promise<string[]> {
    const prisma = db()
    return prisma.$transaction(async tx => {
        const orgAgents = await tx.automations.findMany({ where: { organization_id: organizationId }, select: { id: true } })
        const updatedAgentIds = orgAgents.map(a => a.id)
        if (updatedAgentIds.length === 0) return updatedAgentIds

        await tx.automation_notification_settings.updateMany({
            where: { automation_id: { in: updatedAgentIds } },
            data: { enabled: targetEnabled, action_types: agentDefaultNotifications }
        })

        const existing = await tx.automation_notification_settings.findMany({
            where: { automation_id: { in: updatedAgentIds } },
            select: { automation_id: true }
        })
        const existingIds = new Set(existing.map(s => s.automation_id))
        const missing = updatedAgentIds.filter(id => !existingIds.has(id))
        if (missing.length > 0) {
            await tx.automation_notification_settings.createMany({
                data: missing.map(automation_id => ({ automation_id, enabled: targetEnabled, action_types: agentDefaultNotifications }))
            })
        }
        return updatedAgentIds
    })
}
