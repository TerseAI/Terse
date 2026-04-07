import { z } from "zod"

import { RunHistoryActionType } from "./RunHistoryTypes"

export interface NotificationDestination {
    id: string
    type: NotificationDestinationType
    isActive?: boolean
}

export interface NotificationSettings {
    id: string
    agentDefaultNotifications: RunHistoryActionType[]
    weeklyAgentImprovements: boolean
}

export interface UpdateNotificationSettingsRequest {
    agentDefaultNotifications: RunHistoryActionType[]
    weeklyAgentImprovements: boolean
    applyToAllAgents?: boolean
}

export const NotificationDestinationType = {
    EMAIL: "email",
    SLACK: "slack"
} as const
export const notificationDestinationTypeSchema = z.enum(NotificationDestinationType)
export type NotificationDestinationType = z.infer<typeof notificationDestinationTypeSchema>

export interface EmailNotificationDestination extends NotificationDestination {
    type: "email"
    email: string
}

export interface SlackNotificationDestination extends NotificationDestination {
    type: "slack"
    integrationId: string
    slackChannelId?: string
    slackChannelName?: string
    slackUserId?: string
    slackUserName?: string
}

export const createNotificationDestinationRequestSchema = z.object({
    type: notificationDestinationTypeSchema,
    email: z.email().optional(),
    integrationId: z.string().optional(),
    slackChannelId: z.string().optional(),
    slackChannelName: z.string().optional(),
    slackUserId: z.string().optional(),
    slackUserName: z.string().optional(),
    isActive: z.boolean().optional()
})
export type CreateNotificationDestinationRequest = z.infer<typeof createNotificationDestinationRequestSchema>

export const updateNotificationDestinationRequestSchema = createNotificationDestinationRequestSchema.partial()
export type UpdateNotificationDestinationRequest = z.infer<typeof updateNotificationDestinationRequestSchema>
