export interface NotificationDestination {
    id: number;
    type: NotificationDestinationType;
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
    integrationId: string;
    type: NotificationDestinationType.SLACK;
}