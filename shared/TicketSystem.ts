export enum TicketSystemType {
    Jira = 'jira',
    Linear = 'linear',
    // Future ticket systems can be added here
}

export interface Ticket {
    id: string;
    identifier: string;
    title: string;
    description?: string;
    state: {
        id: string;
        name: string;
    };
    assignee?: {
        id: string;
        name: string;
    } | null;
    priority?: number;
    labels?: Array<{
        id: string;
        name: string;
        color: string;
    }>;
    estimate?: number;
    dueDate?: string;
    project?: {
        id: string;
        name: string;
    } | null;
    team?: {
        id: string;
        name: string;
        key: string;
    };
    createdAt: string;
    updatedAt: string;
}

export interface Comment {
    id: string;
    authorId: string;
    body: string;
    createdAt: string;
    updatedAt?: string;
    [key: string]: any;
}

export interface CreateTicketInput {
    title: string;
    description?: string;
    assigneeId?: string;
    [key: string]: any;
}

export interface UpdateTicketInput {
    title?: string;
    description?: string;
    status?: string;
    assigneeId?: string;
    [key: string]: any;
}

export interface TicketWebhookHandler {
    (ticket: Ticket): void | Promise<void>;
}