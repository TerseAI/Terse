export interface NotificationChannel {
    id: number;
    type: NotificationChannelType;
}

export enum NotificationChannelType {
    EMAIL = "email",
    SLACK = "slack",
}

export interface EmailNotificationChannel extends NotificationChannel {
    type: NotificationChannelType.EMAIL;
    email: string;
}

export interface SlackNotificationChannel extends NotificationChannel {
    integrationId: string;
    type: NotificationChannelType.SLACK;
}