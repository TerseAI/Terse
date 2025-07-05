export enum TicketSystemType {
    Jira = 'jira',
    Linear = 'linear',
    // Future ticket systems can be added here
}

export interface Ticket {
    id: string;
    title: string;
    description?: string;
    status?: string;
    assigneeId?: string;
    // Additional provider specific fields can be stored here
    [key: string]: any;
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

export interface TicketIntegration {
    type: TicketSystemType;
    createTicket(input: CreateTicketInput): Promise<Ticket>;
    updateTicket(id: string, input: UpdateTicketInput): Promise<Ticket>;
    deleteComment(ticketId: string, commentId: string): Promise<void>;
    onNewTicket(handler: TicketWebhookHandler): void;
}
