import { Ticket, TicketSystemType, CreateTicketInput, UpdateTicketInput, User, UserContext, Project, CommitAssociation } from "../shared/TicketSystem";
import { SearchItem } from "../search/SearchItem";
import { Team } from "../shared/TicketSystem";

export interface TicketManager {
    type: TicketSystemType;
    getUserContext(): Promise<UserContext>;
    findTicket(id: string): Promise<Ticket>;
    getTickets(ids: string[]): Promise<Ticket[]>;
    structuredSearch(query: string, options?: StructuredSearchOptions): Promise<Ticket[]>;
    createTicket(input: CreateTicketInput): Promise<Ticket>;
    updateTicket(id: string, input: UpdateTicketInput): Promise<Ticket>;
    commentOnTicket(id: string, comment: string): Promise<void>;
    deleteComment(ticketId: string, commentId: string): Promise<void>;
    getTeams(): Promise<Team[]>;
    me(): Promise<User | null>;
    isTicketComplete(ticketId: string): Promise<boolean>;

    // Used for indexing
    getAllTickets(): Promise<Ticket[]>;
    getAllProjects(): Promise<Project[]>;
    configureWebhook(): Promise<{ webhookId: string, webhookSecret: string } | null>;

    searchItemsForTicket(id: string): Promise<SearchItem[]>;
    searchItemsForProject(id: string): Promise<SearchItem[]>;

    associateCommitsToTicket(ticketId: string, commits: CommitAssociation[], branchName: string): Promise<void>;
}

export type StructuredSearchOptions = {
    teamIds?: string[];
    assigneeEmails?: string[];
    createdByEmails?: string[];
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