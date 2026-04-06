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

export enum NotificationDestinationType {
    EMAIL = "email",
    SLACK = "slack"
}

export interface EmailNotificationDestination extends NotificationDestination {
    type: NotificationDestinationType.EMAIL
    email: string
}

export interface SlackNotificationDestination extends NotificationDestination {
    type: NotificationDestinationType.SLACK
    integrationId: string
    slackChannelId?: string
    slackChannelName?: string
    slackUserId?: string
    slackUserName?: string
}

export const createNotificationDestinationRequestSchema = z.object({
    type: z.enum(NotificationDestinationType),
    email: z.string().email().optional(),
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
