import { RunHistoryActionType } from "./RunHistoryTypes.js";
export interface NotificationDestination {
    id: string;
    type: NotificationDestinationType;
    isActive?: boolean;
}
export interface NotificationSettings {
    id: string;
    agentDefaultNotifications: RunHistoryActionType[];
    weeklyAgentImprovements: boolean;
}
export interface UpdateNotificationSettingsRequest {
    agentDefaultNotifications: RunHistoryActionType[];
    weeklyAgentImprovements: boolean;
    applyToAllAgents?: boolean;
}
export declare enum NotificationDestinationType {
    EMAIL = "email",
    SLACK = "slack"
}
export interface EmailNotificationDestination extends NotificationDestination {
    type: NotificationDestinationType.EMAIL;
    email: string;
}
export interface SlackNotificationDestination extends NotificationDestination {
    type: NotificationDestinationType.SLACK;
    integrationId: string;
    slackChannelId?: string;
    slackChannelName?: string;
    slackUserId?: string;
    slackUserName?: string;
}
export interface CreateNotificationDestinationRequest {
    type: NotificationDestinationType;
    email?: string;
    integrationId?: string;
    slackChannelId?: string;
    slackChannelName?: string;
    slackUserId?: string;
    slackUserName?: string;
    isActive?: boolean;
}
