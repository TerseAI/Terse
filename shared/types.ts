import { Ticket } from "./TicketSystem";

export type User = {
    id: string;
    email: string;
    display_name: string;
    github_username: string | null;
    is_placeholder: boolean;
};

export type SubActivity = {
    summary: string;
    commits: CommitAssociation[];
}

export type CommitAssociation = {
    sha: string;
    message: string;
    url: string;
}

export type ActivityEvent = {
    event_type: string;
    title: string;
    github_repository_owner_id: string;
    github_repository_name: string;
    created_at: Date;
    sub_activities: SubActivity[];
}

export type TicketActivityEvent = {
    ticket: Ticket;
    event_type: string;
    title: string;
}