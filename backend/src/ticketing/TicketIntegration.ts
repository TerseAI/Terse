import { Ticket, TicketSystemType, CreateTicketInput, UpdateTicketInput } from "../shared/TicketSystem";
import { SearchItem } from "../search/SearchItem";

export interface TicketWebhookHandler {
    (ticket: Ticket): void | Promise<void>;
}

export interface TicketIntegration {
    type: TicketSystemType;
    findTicket(id: string): Promise<Ticket>;
    createTicket(input: CreateTicketInput): Promise<Ticket>;
    updateTicket(id: string, input: UpdateTicketInput): Promise<Ticket>;
    deleteComment(ticketId: string, commentId: string): Promise<void>;
    onNewTicket(handler: TicketWebhookHandler): void;
    indexTicket(id: string): Promise<SearchItem[]>;
}