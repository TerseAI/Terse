import { RunHistoryActionType } from "terse-types/RunHistoryTypes"

import { db } from "../../../loaders/prisma"
import { UserNotificationSettings } from "../../../types/prisma"

export async function findUserNotificationSettings(userId: string): Promise<UserNotificationSettings | null> {
    return db().user_notification_settings.findUnique({ where: { user_id: userId } })
}

export async function updateUserNotificationSettings(
    userId: string,
    data: { agent_default_notifications: RunHistoryActionType[]; weekly_agent_improvements: boolean }
): Promise<UserNotificationSettings> {
    return db().user_notification_settings.update({ where: { user_id: userId }, data })
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
