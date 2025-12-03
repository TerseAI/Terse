export interface NotificationDestination {
    id: string;
    type: NotificationDestinationType;
    isActive?: boolean;
}

export enum NotificationDestinationType {
    EMAIL = "email",
    SLACK = "slack",
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
}

export interface CreateSlackNotificationDestinationRequest {
    type: NotificationDestinationType.SLACK;
    integrationId: string;
    slackChannelId?: string;
    slackChannelName?: string;
}