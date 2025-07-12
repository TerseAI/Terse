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

export interface User {
    id: string;
    name: string;
    email: string;
}

export interface UserContext {
    userInfo: User;
    teams: Team[];
    organization: Organization;
    ticketStates: TicketState[];
}

export interface TicketState {
    id: string;
    name: string;
}

export interface Organization {
    name: string;
    createdAt: string;
    createdIssueCount: number;
    userCount: number;
    projects: Project[];
}

export type Project = {
    id: string;
    name: string;
}

export interface Comment {
    id: string;
    authorId: string;
    body: string;
    createdAt: string;
    updatedAt?: string;
    [key: string]: any;
}

export interface Team {
    id: string;
    name: string;
    key: string;
}

export interface CommitAssociation {
    sha: string;
    message: string;
    url: string;
    repository: string;
    branch?: string;
}

export interface CreateTicketInput {
    title: string;
    teamId: string;
    description?: string;
    state?: {
        id: string;
        name: string;
    };
    assignee?: string; // email address of the assignee
    priority?: number;
    project?: {
        id: string;
        name: string;
    };
    associatedCommits?: CommitAssociation[];
    issueType?: string; // For Jira: Task, Bug, Story, Epic, etc.
}

export interface UpdateTicketInput {
    title: string;
    teamId: string;
    description?: string;
    state?: {
        id: string;
        name: string;
    };
    assignee?: string; // email address of the assignee
    priority?: number;
    project?: {
        id: string;
        name: string;
    };
    associatedCommits?: CommitAssociation[];
}

export interface TicketWebhookHandler {
    (ticket: Ticket): void | Promise<void>;
}