import { Ticket, TicketSystemType, CreateTicketInput, UpdateTicketInput, User } from "../shared/TicketSystem";
import { SearchItem } from "../search/SearchItem";
import { Team } from "../shared/TicketSystem";

// export interface TicketWebhookHandler {
//     (ticket: Ticket): void | Promise<void>;
// }

export interface TicketManager {
    type: TicketSystemType;
    findTicket(id: string): Promise<Ticket>;
    structuredSearch(query: string, options?: StructuredSearchOptions): Promise<Ticket[]>;
    createTicket(input: CreateTicketInput): Promise<Ticket>;
    updateTicket(id: string, input: UpdateTicketInput): Promise<Ticket>;
    deleteComment(ticketId: string, commentId: string): Promise<void>;
    // onNewTicket(handler: TicketWebhookHandler): void;
    indexTicket(id: string): Promise<SearchItem[]>;
    getTeams(): Promise<Team[]>;
    me(): Promise<User | null>;
}

export type StructuredSearchOptions = {
    teamIds?: string[];
    assigneeEmails?: string[];
    stateIds?: string[];
    priority?: number[];
    labels?: string[];
    projects?: string[];
    dueDateRange?: { from?: Date; to?: Date };
    createdDateRange?: { from?: Date; to?: Date };
    updatedDateRange?: { from?: Date; to?: Date };
    sortBy?: 'createdAt' | 'updatedAt';
    sortDirection?: 'asc' | 'desc';
    limit?: number;
    includeArchived?: boolean;
    includeSubIssues?: boolean;
    includeComments?: boolean;
    includeAttachments?: boolean;
    includeRelations?: boolean;
}